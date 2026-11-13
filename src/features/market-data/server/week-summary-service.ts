import "server-only";
import mongoose from "mongoose";
import { withLock } from "@/shared/db/lock";
import { connectMongo } from "@/shared/db/mongo";
import { env } from "@/shared/env";
import { withSpan } from "@/shared/lib/tracing";
import { prioritizeInsights, selectWeekNews, type InsightCandidate } from "../domain/day-insight";
import { weekMoveKey } from "../domain/week-move";
import {
  needsWeekSummary,
  WEEK_SUMMARY,
  weekNewsKey,
  type WeekSummary,
} from "../domain/week-summary";
import { getAssetClasses } from "./catalog";
import { GEMINI_BUDGET_MS, geminiModelsWithQuota } from "./gemini-chain";
import { AssetModel } from "./models";
import { storedNewsByTicker, type StoredNewsWithId } from "./news-read";
import { generateWeekReading, storedIndexCloses, weekMoveOfDoc } from "./week-reading";

// A leitura da semana dos ativos da Carteira Alvo (spec 2026-11-13-leitura-da-semana-design.md):
// chamada pelo /api/cron/news depois da coleta (que já trouxe o Bing de cada ativo), com as
// notícias guardadas e o movimento em 7 dias. Refeita quando as notícias, a faixa do movimento ou
// a versão do prompt mudam; a página do ativo só lê.

export type WeekSummaryRun = {
  status: "off" | "busy" | "done";
  candidates: number;
  /** Ativos na vez (`needsWeekSummary`). */
  due: number;
  generated: number;
  /** Gravados sem notícias da semana, sem Gemini. */
  noNews: number;
  /** Respostas recusadas por todos os modelos tentados ou cadeia sem resposta. */
  failed: number;
  /** Respostas recusadas pela validação (cada uma, mesmo quando o modelo seguinte acertou). */
  rejected: number;
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
  rejected: 0,
  deferred: 0,
  geminiCalls: 0,
  quotaExhausted: false,
});

async function save(ticker: string, summary: WeekSummary): Promise<void> {
  await AssetModel.updateOne({ _id: ticker }, { $set: { weekSummary: summary } });
}

/**
 * Gera ou atualiza a leitura da semana dos ativos da Carteira Alvo (`candidates`: só eles, com a
 * quantidade quando houver posição), na ordem de `prioritizeInsights`, no máximo `maxAssets`
 * ativos com Gemini por execução e nenhuma chamada começando com menos de `GEMINI_BUDGET_MS` até
 * o prazo. Sem notícias na semana grava "no-news" sem Gemini. Sem `GEMINI_API_KEY`, grava só esses
 * e devolve `status: "off"`.
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
      "koinos.week.rejected": summary.rejected,
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
  const [docs, classes, newsByTicker, indexCloses] = await Promise.all([
    AssetModel.find({ _id: mongoose.trusted({ $in: tickers }) }).lean(),
    getAssetClasses(tickers),
    storedNewsByTicker(tickers, now),
    storedIndexCloses(),
  ]);
  const assets = new Map(docs.map((doc) => [doc._id, doc]));
  const ordered = prioritizeInsights([...byTicker.values()], (t) => assets.get(t)?.price ?? null);

  const due: { ticker: string; key: string; moveKey: string; items: StoredNewsWithId[] }[] = [];
  for (const { ticker } of ordered) {
    const items = selectWeekNews(newsByTicker.get(ticker) ?? [], now);
    const key = weekNewsKey(items);
    const move = weekMoveOfDoc(assets.get(ticker), classes.get(ticker) ?? null, indexCloses);
    const moveKey = weekMoveKey(move);
    if (!needsWeekSummary(assets.get(ticker)?.weekSummary ?? null, key, moveKey, now)) continue;
    due.push({ ticker, key, moveKey, items });
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
      version: WEEK_SUMMARY.version,
      moveKey: item.moveKey,
      tone: "sem_fato",
      explainsMove: null,
      lenses: [],
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
  if (!apiKey || Date.now() > deadline - GEMINI_BUDGET_MS) {
    summary.deferred = withNews.length;
    return summary;
  }

  const models = await geminiModelsWithQuota(now);
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
    const reading = await generateWeekReading({
      apiKey,
      models,
      ticker: item.ticker,
      assetClass: classes.get(item.ticker) ?? null,
      doc,
      indexCloses,
      items: item.items,
      newsKey: item.key,
      now,
      deadline,
      label: `semana ${item.ticker}`,
    });
    summary.geminiCalls += reading.calls;
    summary.rejected += reading.rejected;
    // Nenhuma chamada começou (prazo): fica para a próxima execução, sem marcar tentativa.
    if (!reading.summary && reading.calls === 0) {
      summary.deferred = withNews.length - index;
      break;
    }
    if (reading.summary) {
      await save(item.ticker, reading.summary);
      summary.generated += 1;
      continue;
    }
    summary.failed += 1;
    const previous = doc?.weekSummary;
    if (previous?.status === "ok") {
      // Uma leitura válida não é apagada por uma falha: só marca a tentativa.
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
        model: reading.model,
        generatedAt: null,
        attemptedAt: now,
        version: WEEK_SUMMARY.version,
        moveKey: item.moveKey,
      });
    }
  }
  return summary;
}
