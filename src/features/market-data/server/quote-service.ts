import "server-only";
import mongoose from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { env } from "@/shared/env";
import { withSpan } from "@/shared/lib/tracing";
import { createBrapiClient } from "../adapters/brapi";
import { yahooProvider } from "../adapters/yahoo";
import { isQuoteStale } from "../domain/market-hours";
import type { Quote, QuoteSource } from "../ports";
import { withLock } from "@/shared/db/lock";
import { AssetModel } from "./models";
import { brapiRequestsThisMonth, recordBrapiRequest } from "./usage";

export type RefreshResult =
  { status: "skipped" } | { status: "done"; stale: number; updated: number; failed: number };

/** Margem de segurança: acima de 90% da cota mensal, a brapi deixa de ser usada até o mês virar. */
const BRAPI_QUOTA_SAFETY = 0.9;

function quoteUpdate(quote: Quote, source: QuoteSource, now: Date) {
  return {
    price: quote.price,
    quoteSource: source,
    quoteFetchedAt: now,
    ...(quote.changePercent !== null && { changePercent: quote.changePercent }),
    ...(quote.name && { name: quote.name }),
    ...(quote.logoUrl && { logoUrl: quote.logoUrl }),
    ...(quote.subType && { subType: quote.subType }),
    ...(quote.quoteTime && { quoteTime: quote.quoteTime }),
  };
}

/**
 * Atualiza as cotações vencidas: brapi primeiro (lote e depois individual); o que faltar vai para o Yahoo.
 * Uma trava no Redis evita duas atualizações ao mesmo tempo (várias abas ou instâncias).
 */
export async function refreshQuotes(
  tickers: readonly string[],
  options: { force?: boolean; now?: Date } = {},
): Promise<RefreshResult> {
  const now = options.now ?? new Date();
  const unique = [...new Set(tickers)];
  if (unique.length === 0) return { status: "done", stale: 0, updated: 0, failed: 0 };

  const result = await withLock("quotes", 60_000, async (): Promise<RefreshResult> => {
    await connectMongo();
    const assets = await AssetModel.find(
      { _id: mongoose.trusted({ $in: unique }) },
      { quoteFetchedAt: 1 },
    ).lean();
    const fetchedAt = new Map(assets.map((asset) => [asset._id, asset.quoteFetchedAt ?? null]));
    const stale = options.force
      ? unique
      : unique.filter((ticker) => isQuoteStale(fetchedAt.get(ticker), now));
    if (stale.length === 0) return { status: "done", stale: 0, updated: 0, failed: 0 };

    const collected = new Map<string, { quote: Quote; source: QuoteSource }>();
    let pending = stale;

    // Um span por fonte: o APM mostra a latência da brapi e quando o Yahoo precisou cobrir.
    const brapiUsed = await brapiRequestsThisMonth(now);
    const brapiAllowed = brapiUsed < env.BRAPI_MONTHLY_QUOTA * BRAPI_QUOTA_SAFETY;
    await withSpan(
      "quotes.brapi",
      {
        "koinos.quotes.requested": pending.length,
        "koinos.brapi.month_requests": brapiUsed,
        "koinos.brapi.month_quota": env.BRAPI_MONTHLY_QUOTA,
        "koinos.brapi.skipped": !brapiAllowed,
      },
      async (span) => {
        if (!brapiAllowed) return;
        const brapi = createBrapiClient({
          token: env.BRAPI_TOKEN,
          onRequest: () => recordBrapiRequest(now),
        });
        const batch = await brapi.getQuotes(pending);
        batch.quotes.forEach((quote, ticker) => collected.set(ticker, { quote, source: "brapi" }));
        pending = pending.filter((ticker) => !collected.has(ticker));
        span.setAttribute("koinos.quotes.resolved", batch.quotes.size);
      },
    );

    if (pending.length > 0) {
      await withSpan(
        "quotes.yahoo-fallback",
        { "koinos.quotes.requested": pending.length },
        async (span) => {
          const batch = await yahooProvider.getQuotes(pending);
          batch.quotes.forEach((quote, ticker) =>
            collected.set(ticker, { quote, source: "yahoo" }),
          );
          pending = pending.filter((ticker) => !collected.has(ticker));
          span.setAttribute("koinos.quotes.resolved", batch.quotes.size);
        },
      );
    }

    if (collected.size > 0) {
      await AssetModel.bulkWrite(
        [...collected.values()].map(({ quote, source }) => ({
          updateOne: {
            filter: { _id: quote.ticker },
            update: { $set: quoteUpdate(quote, source, now) },
            upsert: true,
          },
        })),
      );
    }
    if (pending.length > 0) console.warn("[cotações] sem cotação:", pending.join(", "));

    return { status: "done", stale: stale.length, updated: collected.size, failed: pending.length };
  });

  return result ?? { status: "skipped" };
}
