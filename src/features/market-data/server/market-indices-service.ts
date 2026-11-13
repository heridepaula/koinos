import "server-only";
import { connectMongo } from "@/shared/db/mongo";
import { recordError, withSpan } from "@/shared/lib/tracing";
import { getIndexQuotes } from "../adapters/yahoo";
import {
  isIndexStale,
  MARKET_INDICES,
  marketIndexFromQuote,
  nextIndexCloses,
} from "../domain/market-indices";
import { MarketIndexModel } from "./models";

export type IndicesSummary = { status: "fresh" | "updated" | "error"; updated: number };

/**
 * Atualiza o Ibovespa e o IFIX quando a última leitura venceu (`isIndexStale`: 25 min no pregão;
 * fora dele, só depois do fechamento). Uma falha não lança: o resto do cron segue.
 */
export async function refreshMarketIndices(now = new Date()): Promise<IndicesSummary> {
  return withSpan("market.indices", {}, async (span) => {
    try {
      await connectMongo();
      const stored = await MarketIndexModel.find({}, { fetchedAt: 1, closes: 1 }).lean();
      const fetchedAt = new Map(stored.map((doc) => [doc._id, doc.fetchedAt]));
      const closes = new Map(stored.map((doc) => [doc._id, doc.closes]));
      const stale = MARKET_INDICES.filter((index) => isIndexStale(fetchedAt.get(index.id), now));
      if (stale.length === 0) {
        span.setAttribute("koinos.indices.updated", 0);
        return { status: "fresh", updated: 0 };
      }
      const quotes = await getIndexQuotes(stale.map((index) => index.symbol));
      let updated = 0;
      for (const index of stale) {
        const quote = quotes.get(index.symbol);
        const value = quote ? marketIndexFromQuote(quote, now) : null;
        if (!value) continue;
        // A leitura vira o fechamento do seu pregão: é o histórico da variação da semana.
        await MarketIndexModel.updateOne(
          { _id: index.id },
          {
            $set: {
              ...value,
              fetchedAt: now,
              closes: nextIndexCloses(closes.get(index.id), value),
            },
          },
          { upsert: true },
        );
        updated += 1;
      }
      span.setAttribute("koinos.indices.updated", updated);
      return { status: updated === 0 ? "error" : "updated", updated };
    } catch (error) {
      console.warn("[índices]", error instanceof Error ? error.message : String(error));
      recordError(span, error);
      return { status: "error", updated: 0 };
    }
  });
}
