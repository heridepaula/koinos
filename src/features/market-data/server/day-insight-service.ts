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
  crossesThreshold,
  GEMINI_MODELS,
  isSessionNews,
  nextInsightAttempt,
  prioritizeInsights,
  readFirstArticles,
  recentNews,
  type DayInsight,
  type GeminiModel,
  type InsightCandidate,
  type NewsItem,
} from "../domain/day-insight";
import { quoteSessionDate } from "../domain/market-hours";
import { getAssetClasses } from "./catalog";
import { AssetModel } from "./models";
import { geminiRequestsToday, markGeminiExhausted, recordGeminiRequest } from "./usage";

// Resumo da IA das variações fortes do dia (spec 2026-11-12-resumo-ia-variacao-design.md). Roda
// em segundo plano (ao abrir o app e no cron de 30 em 30 min); a página do ativo só lê.

export type DayInsightSummary = {
  status: "off" | "busy" | "done";
  /** Ativos que passaram do gatilho. */
  eligible: number;
  /** Os que estavam na vez (regra de horários) e foram processados nesta chamada. */
  processed: number;
  generated: number;
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
    const stored = asset.dayInsight ?? null;
    const previous = stored && stored.session.getTime() === session.getTime() ? stored : null;
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

  for (const item of due.slice(0, maxAssets)) {
    if (models.length === 0) {
      summary.quotaExhausted = true;
      break;
    }
    summary.processed += 1;
    const { ticker, session, change, previous } = item;
    const base = {
      session,
      changePercent: change,
      attemptedAt: now,
      kind: "day" as const,
      market: null,
    };
    let news: NewsItem[];
    try {
      news = recentNews(await searchNews(ticker), now);
    } catch (error) {
      // A busca falhou: não grava nada, e a próxima chamada tenta de novo.
      console.warn(`[resumo-ia] ${ticker}:`, errorMessage(error));
      summary.failed += 1;
      continue;
    }
    if (!shouldCallGemini(previous, news, session)) {
      if (previous) await touchAttempt(ticker, now);
      else {
        await saveInsight(ticker, noNews(base));
        summary.noNews += 1;
      }
      continue;
    }
    const { articles, failed } = await readFirstArticles(news, readArticle);
    summary.pagesFailed += failed;
    if (articles.length === 0) {
      if (previous?.status === "ok") await touchAttempt(ticker, now);
      else {
        await saveInsight(ticker, noNews(base));
        summary.noNews += 1;
      }
      continue;
    }
    const prompt = buildInsightPrompt({
      ticker,
      assetClass: classes.get(ticker) ?? null,
      changePercent: change,
      session,
      articles,
    });
    let generated: { text: string; model: GeminiModel } | null = null;
    for (const model of [...models]) {
      summary.geminiCalls += 1;
      await recordGeminiRequest(model, now);
      try {
        generated = { text: await generateText(apiKey, model, prompt), model };
        break;
      } catch (error) {
        console.warn(`[resumo-ia] ${ticker}:`, errorMessage(error));
        // só a cota do dia esgota o modelo; "rate" (por minuto) segue para o próximo da cadeia
        if (error instanceof GeminiError && error.kind === "quota") {
          await markGeminiExhausted(model, QUOTA[model], now);
          models.splice(models.indexOf(model), 1);
        }
      }
    }
    if (generated) {
      await saveInsight(ticker, {
        ...base,
        status: "ok",
        text: generated.text,
        sameDay: articles.some((article) => isSessionNews(article.publishedAt, session)),
        sources: articles.map(plainSource),
        model: generated.model,
        generatedAt: now,
      });
      summary.generated += 1;
    } else {
      summary.failed += 1;
      if (previous?.status === "ok") await touchAttempt(ticker, now);
      else {
        await saveInsight(ticker, {
          ...base,
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

const noNews = (
  base: Pick<DayInsight, "session" | "changePercent" | "attemptedAt" | "kind" | "market">,
): DayInsight => ({
  ...base,
  status: "no-news",
  text: null,
  sameDay: false,
  sources: [],
  model: null,
  generatedAt: null,
});

// Provisório até o serviço usar `insightPlan` (a próxima etapa do plano).
function shouldCallGemini(insight: DayInsight | null, news: readonly NewsItem[], session: Date) {
  if (news.length === 0) return false;
  if (!insight || insight.status !== "ok") return true;
  const known = new Set(insight.sources.map((source) => source.url));
  return news.some((item) => isSessionNews(item.publishedAt, session) && !known.has(item.url));
}
