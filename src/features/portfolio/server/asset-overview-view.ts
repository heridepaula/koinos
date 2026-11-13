import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import {
  getAssetClasses,
  getAssetSnapshots,
  getCatalogEntry,
  getDayInsight,
  getMonthlyCloses,
  getWeekSummary,
} from "@/features/market-data/server";
import { marketSession } from "@/features/market-data";
import { getMyDividends, getMyTransactions } from "@/features/transactions/server";
import { traced } from "@/shared/lib/tracing";
import {
  dailyChange,
  dividendMonths,
  priceSeries,
  pricePeriods,
  yieldOnCost12m,
} from "../domain/asset-overview";
import type { AssetOverview } from "../domain/types";
import { getDividendsView } from "./dividends-view";
import { getPortfolioSnapshot } from "./snapshot";

const TICKER = /^[A-Z0-9]{4,12}$/;

/**
 * Tudo o que o app sabe de um ativo: mercado (só o que já está guardado, sem buscar nada), a
 * estratégia e a posição do dono. O ticker vem da URL: valida antes de consultar.
 */
export const getAssetOverview = cache(
  traced(
    "view.asset-overview",
    async (rawTicker: string): Promise<AssetOverview> => {
      const ticker = rawTicker.toUpperCase();
      if (!TICKER.test(ticker)) notFound();
      await connection(); // usa a hora atual: só em tempo de requisição
      const now = new Date();
      const [entry, transactions, received, classes] = await Promise.all([
        getCatalogEntry(ticker),
        getMyTransactions(),
        getMyDividends(),
        getAssetClasses([ticker]),
      ]);
      const mine = transactions.filter((item) => item.ticker === ticker);
      if (!entry && mine.length === 0) notFound();
      const assetClass = classes.get(ticker) ?? null;
      const [assets, closes, all, ofClass, dividends, dayInsight, weekSummary] = await Promise.all([
        getAssetSnapshots([ticker]),
        getMonthlyCloses([ticker]),
        getPortfolioSnapshot("TODOS"),
        // As linhas da estratégia são da classe da tela: em "TODOS" só vêm as dos FIIs.
        getPortfolioSnapshot(assetClass ?? "TODOS"),
        getDividendsView("TODOS"),
        getDayInsight(ticker, assetClass),
        getWeekSummary(ticker, assetClass, now),
      ]);
      const asset = assets.get(ticker);
      const position = all.positions.find((row) => row.ticker === ticker) ?? null;
      const mineReceived = received.filter((item) => item.ticker === ticker);
      const price = asset?.price ?? null;
      const quoteAt = asset?.quoteFetchedAt ?? null;
      const series = priceSeries({
        monthlyCloses: closes.get(ticker) ?? new Map(),
        recentCloses: asset?.recentCloses ?? [],
        quote: price !== null && quoteAt ? { price, at: quoteAt } : null,
      });
      return {
        ticker,
        name: entry?.name ?? asset?.name ?? null,
        logoUrl: entry?.logoUrl ?? asset?.logoUrl ?? null,
        assetClass,
        price,
        dailyChange: dailyChange(price, asset?.changePercent ?? null),
        market: {
          priceToBook: asset?.priceToBook ?? null,
          dy12m: asset?.dy12m ?? null,
          dividends12m: asset?.dividends12m ?? null,
          lastDividend: asset?.lastDividend ?? null,
          segment: asset?.fii?.segment ?? null,
          quoteFetchedAt: quoteAt,
          session: marketSession(now, quoteAt),
        },
        pricePeriods: pricePeriods(series, now),
        strategy:
          ofClass.strategy.rows.find((row) => row.ticker === ticker && row.configured) ?? null,
        position,
        yoc: position ? yieldOnCost12m(mineReceived, position, now) : null,
        closed: all.closed.find((row) => row.ticker === ticker) ?? null,
        orders: mine
          .map(({ date, type, quantity, unitPrice, fees, kind }) => ({
            date,
            type,
            quantity,
            unitPrice,
            fees,
            kind,
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime()),
        received: mineReceived
          .map(({ paidAt, kind, amount, perShare }) => ({ paidAt, kind, amount, perShare }))
          .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime()),
        dividendMonths: dividendMonths(mineReceived, now),
        upcoming: dividends.upcoming.filter((item) => item.ticker === ticker),
        dayInsight,
        weekSummary,
      };
    },
    (overview) => ({
      "koinos.view.class_filter": overview.assetClass ?? "TODOS",
      "koinos.view.orders": overview.orders.length,
      "koinos.view.dividends": overview.received.length,
    }),
  ),
);
