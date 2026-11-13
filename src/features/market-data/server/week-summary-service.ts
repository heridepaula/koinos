import "server-only";
import mongoose from "mongoose";
import { withLock } from "@/shared/db/lock";
import { connectMongo } from "@/shared/db/mongo";
import { env } from "@/shared/env";
import { withSpan } from "@/shared/lib/tracing";
import {
  prioritizeInsights,
  selectWeekNews,
  type InsightCandidate,
  type NewsItem,
} from "../domain/day-insight";
import { describeAsset } from "../domain/radar";
import {
  buildWeekSummaryPrompt,
  needsWeekSummary,
  validateWeekSummary,
  WEEK_SUMMARY,
  weekNewsKey,
  type WeekSummary,
} from "../domain/week-summary";
import { getAssetClasses } from "./catalog";
import { GEMINI_BUDGET_MS, generateWithChain, geminiModelsWithQuota } from "./gemini-chain";
import { AssetModel } from "./models";
import { storedNewsByTicker, type StoredNewsWithId } from "./news-read";
import { radarInputOf } from "./radar-service";

// Resumo da semana dos ativos da Carteira Alvo (plano 2026-11-13-resumo-semana-carteira-alvo.md):
// chamado pelo /api/cron/news depois da coleta, só com as notícias guardadas (nenhum Bing, nenhuma
// página lida). Refeito só quando as notícias da semana mudam; a página do ativo só lê.

export type WeekSummaryRun = {
  status: "off" | "busy" | "done";
  candidates: number;
  /** Ativos na vez (`needsWeekSummary`). */
  due: number;
  generated: number;
  /** Gravados sem notícias da semana, sem Gemini. */
  noNews: number;
  /** Respostas recusadas pela validação ou cadeia sem resposta. */
  failed: number;
  /** Ativos que ficaram para a próxima chamada (tempo ou `maxAssets`). */
  deferred: number;
  geminiCalls: number;
  quotaExhausted: boolean;
};

const empty = (status: WeekSummaryRun["status"]): WeekSummaryRun => ({
  status,
  candidates: 0,
  due: 0,
  generated: 0,
  noNews: 0,
  failed: 0,
  deferred: 0,
  geminiCalls: 0,
  quotaExhausted: false,
});

const plainSource = ({ title, publisher, url, publishedAt }: NewsItem): NewsItem => ({
  title,
  publisher,
  url,
  publishedAt,
});

async function save(ticker: string, summary: WeekSummary): Promise<void> {
  await AssetModel.updateOne({ _id: ticker }, { $set: { weekSummary: summary } });
}

/**
 * Gera ou atualiza o resumo da semana dos ativos da Carteira Alvo (`candidates`: só eles, com a
 * quantidade quando houver posição), na ordem de `prioritizeInsights`, no máximo `maxAssets`
 * chamadas ao Gemini por execução e nenhuma começando com menos de `GEMINI_BUDGET_MS` até o prazo.
 * Sem notícias na semana grava "no-news" sem Gemini. Sem `GEMINI_API_KEY`, grava só esses e
 * devolve `status: "off"`.
 */
export async function refreshWeekSummaries(
  candidates: readonly InsightCandidate[],
  options: { deadline: number; maxAssets?: number; now?: Date },
): Promise<WeekSummaryRun> {
  const apiKey = env.GEMINI_API_KEY ?? null;
  const now = options.now ?? new Date();
  const maxAssets = options.maxAssets ?? WEEK_SUMMARY.maxAssets;
  return withSpan("week.summaries", {}, async (span) => {
    const summary =
      (await withLock("week-summaries", 120_000, () =>
        run(apiKey, candidates, maxAssets, now, options.deadline),
      )) ?? empty("busy");
    span.setAttributes({
      "koinos.week.status": summary.status,
      "koinos.week.candidates": summary.candidates,
      "koinos.week.due": summary.due,
      "koinos.week.generated": summary.generated,
      "koinos.week.no_news": summary.noNews,
      "koinos.week.failed": summary.failed,
      "koinos.week.deferred": summary.deferred,
      "koinos.week.gemini_calls": summary.geminiCalls,
      "koinos.week.quota_exhausted": summary.quotaExhausted,
    });
    return summary;
  });
}

async function run(
  apiKey: string | null,
  candidates: readonly InsightCandidate[],
  maxAssets: number,
  now: Date,
  deadline: number,
): Promise<WeekSummaryRun> {
  const summary = empty(apiKey ? "done" : "off");
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
  summary.candidates = tickers.length;
  if (tickers.length === 0) return summary;
  await connectMongo();
  const [docs, classes, newsByTicker] = await Promise.all([
    AssetModel.find({ _id: mongoose.trusted({ $in: tickers }) }).lean(),
    getAssetClasses(tickers),
    storedNewsByTicker(tickers, now),
  ]);
  const assets = new Map(docs.map((doc) => [doc._id, doc]));
  const ordered = prioritizeInsights([...byTicker.values()], (t) => assets.get(t)?.price ?? null);

  const due: { ticker: string; key: string; items: StoredNewsWithId[] }[] = [];
  for (const { ticker } of ordered) {
    const items = selectWeekNews(newsByTicker.get(ticker) ?? [], now);
    const key = weekNewsKey(items);
    if (!needsWeekSummary(assets.get(ticker)?.weekSummary ?? null, key, now)) continue;
    due.push({ ticker, key, items });
  }
  summary.due = due.length;

  // Sem notícias na semana: grava sem Gemini, mesmo sem chave ou sem cota.
  const withNews: typeof due = [];
  const noNewsWrites: { updateOne: { filter: { _id: string }; update: { $set: object } } }[] = [];
  for (const item of due) {
    if (item.key !== "") {
      withNews.push(item);
      continue;
    }
    const noNews: WeekSummary = {
      newsKey: "",
      status: "no-news",
      text: null,
      sources: [],
      model: null,
      generatedAt: now,
      attemptedAt: now,
    };
    noNewsWrites.push({
      updateOne: { filter: { _id: item.ticker }, update: { $set: { weekSummary: noNews } } },
    });
  }
  // Uma só escrita para todos os "no-news"; sem prazo, ficam para a próxima execução.
  if (noNewsWrites.length > 0 && Date.now() <= deadline) {
    await AssetModel.bulkWrite(noNewsWrites);
    summary.noNews += noNewsWrites.length;
  }
  if (withNews.length === 0) return summary;
  if (!apiKey) {
    summary.deferred = withNews.length;
    return summary;
  }
  if (Date.now() > deadline - GEMINI_BUDGET_MS) {
    summary.deferred = withNews.length;
    return summary;
  }

  const models = await geminiModelsWithQuota(now);
  const options = { temperature: 0.4, maxOutputTokens: 1024, timeoutMs: 8_000 };
  for (const [index, item] of withNews.entries()) {
    if (index >= maxAssets || Date.now() > deadline - GEMINI_BUDGET_MS) {
      summary.deferred = withNews.length - index;
      break;
    }
    if (models.length === 0) {
      summary.quotaExhausted = true;
      summary.deferred = withNews.length - index;
      break;
    }
    const doc = assets.get(item.ticker);
    const assetClass = classes.get(item.ticker) ?? null;
    const input = doc && assetClass ? radarInputOf(doc, assetClass, null, now) : null;
    const prompt = buildWeekSummaryPrompt({
      ticker: item.ticker,
      description: input
        ? describeAsset(input)
        : assetClass === "FII"
          ? "um fundo imobiliário"
          : "uma empresa da bolsa",
      items: item.items,
    });
    const { result, calls } = await generateWithChain(
      apiKey,
      models,
      prompt,
      options,
      now,
      `semana ${item.ticker}`,
      deadline,
    );
    summary.geminiCalls += calls;
    // Nenhuma chamada começou (prazo): fica para a próxima execução, sem marcar tentativa.
    if (!result && calls === 0) {
      summary.deferred = withNews.length - index;
      break;
    }
    const text = result ? validateWeekSummary(result.text, result.finishReason) : null;
    if (result && text !== null) {
      await save(item.ticker, {
        newsKey: item.key,
        status: "ok",
        text,
        sources: item.items.map(plainSource),
        model: result.model,
        generatedAt: now,
        attemptedAt: now,
      });
      summary.generated += 1;
      continue;
    }
    summary.failed += 1;
    const previous = doc?.weekSummary;
    if (previous?.status === "ok") {
      // Um resumo válido não é apagado por uma falha: só marca a tentativa (espera 6 h).
      await AssetModel.updateOne(
        { _id: item.ticker },
        { $set: { "weekSummary.attemptedAt": now } },
      );
    } else {
      await save(item.ticker, {
        newsKey: item.key,
        status: "failed",
        text: null,
        sources: [],
        model: result?.model ?? null,
        generatedAt: null,
        attemptedAt: now,
      });
    }
  }
  return summary;
}
