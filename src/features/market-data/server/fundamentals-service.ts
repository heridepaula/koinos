import "server-only";
import mongoose from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { env } from "@/shared/env";
import { fetchBolsaiFii } from "../adapters/bolsai";
import { AssetModel } from "./models";

/** Igual ao limite da leitura (assets-read): VP mais velho que isso conta como faltando. */
const FUNDAMENTALS_MAX_AGE_MS = 60 * 86_400_000;
/** Ao abrir o app, um ticker que já foi tentado espera isso antes de nova tentativa. */
const RETRY_AFTER_MS = 6 * 60 * 60 * 1000;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export type FundamentalsSummary = {
  requested: number;
  updated: number;
  /** A API respondeu, mas sem VP para o ticker (fora da lista de FIIs dela). */
  missing: number;
  failed: number;
};

/**
 * Atualiza o VP e o P/VP de cada ticker na usebolsai, uma chamada por vez (cerca de 0,1 s cada).
 * Roda no cron das 2h. Um ticker que falha mantém o valor anterior: o VP muda só uma vez por mês.
 */
export async function refreshFundamentals(
  tickers: readonly string[],
  now = new Date(),
): Promise<FundamentalsSummary> {
  const unique = [...new Set(tickers)];
  const summary: FundamentalsSummary = {
    requested: unique.length,
    updated: 0,
    missing: 0,
    failed: 0,
  };
  const apiKey = env.BOLSAI_API_KEY;
  if (!apiKey || unique.length === 0) return summary;
  await connectMongo();
  for (const ticker of unique) {
    try {
      const data = await fetchBolsaiFii(ticker, apiKey);
      if (!data) {
        summary.missing++;
        await AssetModel.updateOne(
          { _id: ticker },
          { $set: { fundamentalsCheckedAt: now } },
          { upsert: true },
        );
        continue;
      }
      await AssetModel.updateOne(
        { _id: ticker },
        {
          $set: {
            bookValuePerShare: data.bookValuePerShare,
            bookValueMonth: data.bookValueMonth,
            priceToBook: data.priceToBook,
            fundamentalsFetchedAt: now,
            fundamentalsCheckedAt: now,
          },
        },
        { upsert: true },
      );
      summary.updated++;
    } catch (error) {
      summary.failed++;
      await AssetModel.updateOne(
        { _id: ticker },
        { $set: { fundamentalsCheckedAt: now } },
        { upsert: true },
      ).catch(() => undefined);
      console.warn(`[P/VP] ${ticker}:`, errorMessage(error));
    }
  }
  return summary;
}

/**
 * Ao abrir o app: busca só os tickers sem VP (ou com VP de mais de 60 dias) que não foram tentados
 * nas últimas 6 h. Assim o P/VP aparece sem esperar o cron das 2h, e um ticker que a usebolsai
 * não tem não gasta a cota a cada página.
 */
export async function refreshMissingFundamentals(
  tickers: readonly string[],
  now = new Date(),
): Promise<FundamentalsSummary> {
  const unique = [...new Set(tickers)];
  if (!env.BOLSAI_API_KEY || unique.length === 0) {
    return { requested: 0, updated: 0, missing: 0, failed: 0 };
  }
  await connectMongo();
  const docs = await AssetModel.find(
    { _id: mongoose.trusted({ $in: unique }) },
    { bookValuePerShare: 1, fundamentalsFetchedAt: 1, fundamentalsCheckedAt: 1 },
  ).lean();
  const byTicker = new Map(docs.map((doc) => [doc._id, doc]));
  const due = unique.filter((ticker) => {
    const doc = byTicker.get(ticker);
    const fresh =
      doc?.bookValuePerShare != null &&
      (doc.fundamentalsFetchedAt?.getTime() ?? 0) >= now.getTime() - FUNDAMENTALS_MAX_AGE_MS;
    const triedRecently =
      (doc?.fundamentalsCheckedAt?.getTime() ?? 0) >= now.getTime() - RETRY_AFTER_MS;
    return !fresh && !triedRecently;
  });
  return refreshFundamentals(due, now);
}
