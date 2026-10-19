import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import {
  ensureMonthlyCloses,
  getAssetSnapshots,
  getMonthlyCloses,
  type AssetSnapshot,
} from "@/features/market-data/server";
import { getMyTargetAssets } from "@/features/strategy/server";
import { replayLedger } from "@/features/transactions";
import { getMyDividends, getMyTransactions } from "@/features/transactions/server";
import { currentMonthKey, monthKeyOfTradeDate } from "@/shared/lib/time";
import { computeEvolution } from "../domain/evolution";
import { buildSnapshot } from "../domain/snapshot";
import type { EvolutionPoint, PortfolioSnapshot, PriceInfo } from "../domain/types";

function toPriceInfo(assets: ReadonlyMap<string, AssetSnapshot>): Map<string, PriceInfo> {
  return new Map(
    [...assets].map(([ticker, asset]) => [
      ticker,
      {
        name: asset.name,
        logoUrl: asset.logoUrl,
        subType: asset.subType,
        price: asset.price,
        changePercent: asset.changePercent,
        quoteFetchedAt: asset.quoteFetchedAt,
        dy12m: asset.dy12m,
        lastDividend: asset.lastDividend,
      },
    ]),
  );
}

/**
 * Visão consolidada da carteira do usuário logado (dashboard, Carteira Alvo, Recomendações).
 * Os dados vêm da sessão (DAL); o resultado é um DTO sem ids internos.
 */
export const getPortfolioSnapshot = cache(async (): Promise<PortfolioSnapshot> => {
  await connection(); // usa a hora atual: só em tempo de requisição
  const [transactions, targets, dividends] = await Promise.all([
    getMyTransactions(),
    getMyTargetAssets(),
    getMyDividends(),
  ]);
  const tickers = [
    ...new Set([...transactions.map((t) => t.ticker), ...targets.map((t) => t.ticker)]),
  ];
  const assets = await getAssetSnapshots(tickers);
  return buildSnapshot({
    now: new Date(),
    transactions,
    targets,
    dividends,
    prices: toPriceInfo(assets),
  });
});

/** Evolução mensal. Completa no Yahoo os fechamentos que faltam (uma vez por mês e ticker). */
export async function getEvolution(): Promise<EvolutionPoint[]> {
  await connection();
  const now = new Date();
  const transactions = await getMyTransactions();
  if (transactions.length === 0) return [];
  const { positions } = replayLedger(transactions);
  await ensureMonthlyCloses(
    positions.map((position) => ({
      ticker: position.ticker,
      fromMonth: monthKeyOfTradeDate(position.firstDate),
    })),
    now,
  );
  const tickers = positions.map((position) => position.ticker);
  const [closes, assets] = await Promise.all([
    getMonthlyCloses(tickers),
    getAssetSnapshots(tickers),
  ]);
  const currentPrices = new Map([...assets].map(([ticker, asset]) => [ticker, asset.price]));
  return computeEvolution(transactions, closes, currentPrices, currentMonthKey(now));
}
