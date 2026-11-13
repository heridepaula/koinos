import "server-only";
import mongoose from "mongoose";
import { DAY_INSIGHT, type StoredNews } from "../domain/day-insight";
import { NewsItemModel } from "./models";

/** Uma notícia guardada, com o `_id` do `news_items` (a chave do resumo da semana usa os ids). */
export type StoredNewsWithId = StoredNews & { id: string };

/**
 * As notícias guardadas dos últimos 7 dias de cada ticker, da mais nova à mais velha. Usada pelo
 * resumo do dia e pelo resumo da semana (a seleção da semana é `selectWeekNews`).
 */
export async function storedNewsByTicker(
  tickers: readonly string[],
  now: Date,
): Promise<Map<string, StoredNewsWithId[]>> {
  const byTicker = new Map<string, StoredNewsWithId[]>();
  if (tickers.length === 0) return byTicker;
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
  for (const doc of docs) {
    const item: StoredNewsWithId = {
      id: doc._id,
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
