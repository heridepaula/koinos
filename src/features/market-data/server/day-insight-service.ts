import "server-only";
import mongoose from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { withLock } from "@/shared/db/lock";
import { env } from "@/shared/env";
import { withSpan } from "@/shared/lib/tracing";
import { generateText, GeminiError } from "../adapters/gemini";
import { readArticle, searchNews } from "../adapters/news";
import {
  availableModels,
  buildInsightPrompt,
  buildWeekPrompt,
  crossesThreshold,
  DAY_INSIGHT,
  GEMINI_MODELS,
  insightMarket,
  insightPlan,
  mergeSessionNews,
  nextInsightAttempt,
  prioritizeInsights,
  readFirstArticles,
  sameMovement,
  weekNews,
  withInsightDefaults,
  type DayInsight,
  type DayInsightKind,
  type GeminiModel,
  type InsightCandidate,
  type InsightNews,
  type NewsItem,
  type StoredNews,
} from "../domain/day-insight";
import { quoteSessionDate } from "../domain/market-hours";
import type { MarketIndexId } from "../domain/market-indices";
import { getAssetClasses } from "./catalog";
import { AssetModel, MarketIndexModel, NewsItemModel } from "./models";
import { geminiRequestsToday, markGeminiExhausted, recordGeminiRequest } from "./usage";

// Resumo da IA das variações fortes do dia (spec 2026-11-12-resumo-ia-variacao-design.md e plano
// 2026-11-13-resumo-dia-sem-noticia-antiga.md). Roda em segundo plano (ao abrir o app e no cron de
// 30 em 30 min); a página do ativo só lê. Só notícia do pregão (`news_items` + Bing) explica o
// movimento; sem ela, o resumo é da semana (só `news_items`). O índice do mesmo pregão
// (`market_indices`) dá a leitura contra o mercado, calculada pelo código.

export type DayInsightSummary = {
  status: "off" | "busy" | "done";
  /** Ativos que passaram do gatilho. */
  eligible: number;
  /** Os que estavam na vez (regra de horários) e foram processados nesta chamada. */
  processed: number;
  generated: number;
  /** Resumos do dia gerados pelo Gemini. */
  day: number;
  /** Resumos da semana gerados pelo Gemini. */
  week: number;
  noNews: number;
  failed: number;
  geminiCalls: number;
  pagesFailed: number;
  /** Nenhum modelo da cadeia tinha cota. */
  quotaExhausted: boolean;
};

const empty = (status: DayInsightSummary["status"]): DayInsightSummary => ({
  status,
  eligible: 0,
  processed: 0,
  generated: 0,
  day: 0,
  week: 0,
  noNews: 0,
  failed: 0,
  geminiCalls: 0,
  pagesFailed: 0,
  quotaExhausted: false,
});

const QUOTA: Record<GeminiModel, number> = Object.fromEntries(
  GEMINI_MODELS.map((model) => [model.id, model.dailyQuota]),
) as Record<GeminiModel, number>;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const plainSource = ({ title, publisher, url, publishedAt }: NewsItem): NewsItem => ({
  title,
  publisher,
  url,
  publishedAt,
});

async function saveInsight(ticker: string, insight: DayInsight): Promise<void> {
  await AssetModel.updateOne({ _id: ticker }, { $set: { dayInsight: insight } });
}

async function touchAttempt(ticker: string, now: Date): Promise<void> {
  await AssetModel.updateOne({ _id: ticker }, { $set: { "dayInsight.attemptedAt": now } });
}

/**
 * O texto de uma notícia: a página lida pelo Readability, ou, nas fontes que não podem ser lidas
 * (Suno, `readPage: false`), o título e o resumo do RSS.
 */
async function readInsightNews(item: InsightNews): Promise<string | null> {
  if (item.readPage) return readArticle(item);
  return [item.title, item.description].filter(Boolean).join(". ");
}

/** As notícias guardadas dos últimos 7 dias de cada ticker, da mais nova à mais velha. */
async function storedNewsByTicker(
  tickers: readonly string[],
  now: Date,
): Promise<Map<string, StoredNews[]>> {
  const from = new Date(now.getTime() - DAY_INSIGHT.maxNewsAgeDays * 86_400_000);
  const docs = await NewsItemModel.find(
    {
      tickers: mongoose.trusted({ $in: tickers }),
      publishedAt: mongoose.trusted({ $gte: from }),
    },
    {
      url: 1,
      title: 1,
      publisher: 1,
      publishedAt: 1,
      description: 1,
      tickers: 1,
      topics: 1,
      readPage: 1,
    },
  )
    .sort({ publishedAt: -1 })
    .lean();
  const wanted = new Set(tickers);
  const byTicker = new Map<string, StoredNews[]>();
  for (const doc of docs) {
    const item: StoredNews = {
      title: doc.title,
      publisher: doc.publisher,
      url: doc.url,
      publishedAt: doc.publishedAt,
      description: doc.description ?? null,
      topics: doc.topics ?? [],
      readPage: doc.readPage !== false,
    };
    for (const ticker of doc.tickers ?? []) {
      if (!wanted.has(ticker)) continue;
      byTicker.set(ticker, [...(byTicker.get(ticker) ?? []), item]);
    }
  }
  return byTicker;
}

/** A variação de cada índice guardada em `market_indices`, com o seu pregão. */
async function storedIndices(): Promise<
  Map<MarketIndexId, { changePercent: number; session: Date }>
> {
  const docs = await MarketIndexModel.find({}, { changePercent: 1, session: 1 }).lean();
  return new Map(
    docs.map((doc) => [
      doc._id as MarketIndexId,
      { changePercent: doc.changePercent, session: doc.session },
    ]),
  );
}

/**
 * Gera ou atualiza o resumo dos ativos que passaram do gatilho, na ordem de prioridade (posições
 * por valor, depois Carteira Alvo por rank), no máximo `maxAssets` por chamada. Sem
 * `GEMINI_API_KEY`, não faz nada.
 */
export async function refreshDayInsights(
  candidates: readonly InsightCandidate[],
  options: { maxAssets: number; now?: Date },
): Promise<DayInsightSummary> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return empty("off");
  const now = options.now ?? new Date();
  return withSpan("insights.generate", {}, async (span) => {
    const summary = (await withLock("day-insights", 120_000, () =>
      run(apiKey, candidates, options.maxAssets, now),
    )) ?? { ...empty("busy") };
    span.setAttributes({
      "koinos.insights.status": summary.status,
      "koinos.insights.eligible": summary.eligible,
      "koinos.insights.processed": summary.processed,
      "koinos.insights.generated": summary.generated,
      "koinos.insights.day": summary.day,
      "koinos.insights.week": summary.week,
      "koinos.insights.no_news": summary.noNews,
      "koinos.insights.failed": summary.failed,
      "koinos.insights.gemini_calls": summary.geminiCalls,
      "koinos.insights.pages_failed": summary.pagesFailed,
      "koinos.insights.quota_exhausted": summary.quotaExhausted,
    });
    return summary;
  });
}

async function run(
  apiKey: string,
  candidates: readonly InsightCandidate[],
  maxAssets: number,
  now: Date,
): Promise<DayInsightSummary> {
  const summary = empty("done");
  const byTicker = new Map<string, InsightCandidate>();
  for (const candidate of candidates) {
    const known = byTicker.get(candidate.ticker);
    byTicker.set(candidate.ticker, {
      ticker: candidate.ticker,
      quantity: (known?.quantity ?? 0) + (candidate.quantity ?? 0) || null,
      rank: known?.rank ?? candidate.rank,
    });
  }
  const tickers = [...byTicker.keys()];
  if (tickers.length === 0) return summary;
  await connectMongo();
  const [docs, classes] = await Promise.all([
    AssetModel.find(
      { _id: mongoose.trusted({ $in: tickers }) },
      { price: 1, changePercent: 1, quoteFetchedAt: 1, dayInsight: 1 },
    ).lean(),
    getAssetClasses(tickers),
  ]);
  const assets = new Map(docs.map((doc) => [doc._id, doc]));
  const ordered = prioritizeInsights(
    [...byTicker.values()],
    (ticker) => assets.get(ticker)?.price ?? null,
  );
  const due: { ticker: string; session: Date; change: number; previous: DayInsight | null }[] = [];
  for (const candidate of ordered) {
    const asset = assets.get(candidate.ticker);
    if (!asset?.quoteFetchedAt || typeof asset.changePercent !== "number") continue;
    if (!crossesThreshold(classes.get(candidate.ticker) ?? null, asset.changePercent)) continue;
    summary.eligible += 1;
    const session = quoteSessionDate(asset.quoteFetchedAt);
    const stored = asset.dayInsight ? withInsightDefaults(asset.dayInsight) : null;
    // Só conta o resumo deste movimento: mesmo pregão e mesmo sinal. Sinal trocado gera de novo.
    const previous = sameMovement(stored, session, asset.changePercent) ? stored : null;
    if (!nextInsightAttempt(previous, session, now)) continue;
    due.push({ ticker: candidate.ticker, session, change: asset.changePercent, previous });
  }
  if (due.length === 0) return summary;

  const usage = await geminiRequestsToday(
    GEMINI_MODELS.map((model) => model.id),
    now,
  );
  const models = availableModels((model) => usage.get(model) ?? 0);
  if (models.length === 0) {
    // Sem cota, nem busca no Bing: não marca tentativas que não poderiam virar resumo.
    summary.quotaExhausted = true;
    return summary;
  }

  const batch = due.slice(0, maxAssets);
  const [newsByTicker, indices] = await Promise.all([
    storedNewsByTicker(
      batch.map((item) => item.ticker),
      now,
    ),
    storedIndices(),
  ]);

  /** O texto do primeiro modelo da cadeia que responder, ou null. */
  async function generate(ticker: string, prompt: string) {
    for (const model of [...models]) {
      summary.geminiCalls += 1;
      await recordGeminiRequest(model, now);
      try {
        return { text: await generateText(apiKey, model, prompt), model };
      } catch (error) {
        console.warn(`[resumo-ia] ${ticker}:`, errorMessage(error));
        // só a cota do dia esgota o modelo; "rate" (por minuto) segue para o próximo da cadeia
        if (error instanceof GeminiError && error.kind === "quota") {
          await markGeminiExhausted(model, QUOTA[model], now);
          models.splice(models.indexOf(model), 1);
        }
      }
    }
    return null;
  }

  for (const item of batch) {
    if (models.length === 0) {
      summary.quotaExhausted = true;
      break;
    }
    summary.processed += 1;
    const { ticker, session, change, previous } = item;
    const assetClass = classes.get(ticker) ?? null;
    const market = insightMarket(assetClass, change, indices, session);
    const base = { session, changePercent: change, attemptedAt: now, market };
    let bing: NewsItem[] = [];
    try {
      bing = await searchNews(ticker);
    } catch (error) {
      // Sem o Bing, seguem as notícias guardadas.
      console.warn(`[resumo-ia] ${ticker}:`, errorMessage(error));
    }
    const stored = newsByTicker.get(ticker) ?? [];
    const weekItems = weekNews(stored, now);
    const plan = insightPlan(previous, mergeSessionNews(stored, bing, session), weekItems);
    if (plan.mode === "none") {
      await touchAttempt(ticker, now);
      continue;
    }

    let kind: DayInsightKind = plan.mode;
    let prompt = "";
    let sources: NewsItem[] = [];
    if (plan.mode === "day") {
      const { articles, failed } = await readFirstArticles(plan.news, readInsightNews);
      summary.pagesFailed += failed;
      if (articles.length > 0) {
        prompt = buildInsightPrompt({
          ticker,
          assetClass,
          changePercent: change,
          session,
          articles,
          market,
        });
        sources = articles.map(plainSource);
      } else if (previous && previous.status !== "failed") {
        await touchAttempt(ticker, now);
        continue;
      } else {
        // Nenhuma página do pregão pôde ser lida: vale o resumo da semana.
        kind = "week";
      }
    }
    if (kind === "week") {
      if (weekItems.length === 0) {
        await saveInsight(ticker, noNews(base));
        summary.noNews += 1;
        continue;
      }
      prompt = buildWeekPrompt({
        ticker,
        assetClass,
        changePercent: change,
        session,
        items: weekItems,
        market,
      });
      sources = weekItems.map(plainSource);
    }

    const generated = await generate(ticker, prompt);
    if (generated) {
      await saveInsight(ticker, {
        ...base,
        kind,
        status: "ok",
        text: generated.text,
        sameDay: kind === "day",
        sources,
        model: generated.model,
        generatedAt: now,
      });
      summary.generated += 1;
      summary[kind] += 1;
    } else {
      summary.failed += 1;
      if (previous?.status === "ok") await touchAttempt(ticker, now);
      else {
        await saveInsight(ticker, {
          ...base,
          kind,
          status: "failed",
          text: null,
          sameDay: false,
          sources: [],
          model: null,
          generatedAt: null,
        });
      }
    }
  }
  return summary;
}

/** Sem notícia do pregão nem da semana: grava sem chamar o Gemini, com a leitura do mercado. */
const noNews = (base: Pick<DayInsight, "session" | "changePercent" | "attemptedAt" | "market">) =>
  ({
    ...base,
    kind: "week",
    status: "no-news",
    text: null,
    sameDay: false,
    sources: [],
    model: null,
    generatedAt: null,
  }) satisfies DayInsight;
