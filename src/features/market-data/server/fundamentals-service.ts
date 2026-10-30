import "server-only";
import { connectMongo } from "@/shared/db/mongo";
import { env } from "@/shared/env";
import { fetchBolsaiFii } from "../adapters/bolsai";
import { AssetModel } from "./models";

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
          },
        },
        { upsert: true },
      );
      summary.updated++;
    } catch (error) {
      summary.failed++;
      console.warn(`[P/VP] ${ticker}:`, errorMessage(error));
    }
  }
  return summary;
}
