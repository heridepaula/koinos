import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import {
  ensureMonthlyCloses,
  ensureRecentCloses,
  getAssetClasses,
  getAssetSnapshots,
  getMonthlyCloses,
  type AssetSnapshot,
} from "@/features/market-data/server";
import { getMyTargetAssets } from "@/features/strategy/server";
import { replayLedger } from "@/features/transactions";
import { getMyDividends, getMyTransactions } from "@/features/transactions/server";
import { byClass, type ClassFilter } from "@/shared/lib/class-filter";
import { currentMonthKey, monthKeyOfTradeDate } from "@/shared/lib/time";
import { traced } from "@/shared/lib/tracing";
import { computeEvolution } from "../domain/evolution";
import { periodResults } from "../domain/period-results";
import { buildSnapshot, scopeToClass } from "../domain/snapshot";
import type { EvolutionPoint, PeriodResult, PortfolioSnapshot, PriceInfo } from "../domain/types";

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
        priceToBook: asset.priceToBook,
        dividends12m: asset.dividends12m,
        fii: asset.fii,
      },
    ]),
  );
}

const snapshotFor = cache(
  traced(
    "view.portfolio-snapshot",
    async (filter: ClassFilter): Promise<PortfolioSnapshot> => {
      await connection(); // usa a hora atual: só em tempo de requisição
      const [transactions, targets, dividends] = await Promise.all([
        getMyTransactions(),
        getMyTargetAssets(),
        getMyDividends(),
      ]);
      const tickers = [
        ...new Set([...transactions.map((t) => t.ticker), ...targets.map((t) => t.ticker)]),
      ];
      const [assets, classes] = await Promise.all([
        getAssetSnapshots(tickers),
        getAssetClasses(tickers),
      ]);
      return buildSnapshot(
        scopeToClass(
          {
            now: new Date(),
            transactions,
            targets,
            dividends,
            prices: toPriceInfo(assets),
            classes,
          },
          filter,
        ),
      );
    },
    (snapshot, filter) => ({
      "koinos.view.positions": snapshot.positions.length,
      "koinos.view.closed": snapshot.closed.length,
      "koinos.view.strategy_rows": snapshot.strategy.rows.length,
      "koinos.view.stale_quotes": snapshot.quotes.staleCount,
      "koinos.view.alerts": snapshot.alerts.length,
      "koinos.view.class_filter": filter,
    }),
  ),
);

/**
 * Visão consolidada da carteira do usuário logado (dashboard, Carteira Alvo, Recomendações), na
 * classe pedida. O `cache` é por argumento: a função normaliza o padrão para que `()` e
 * `("TODOS")` sejam a mesma consulta. O resultado é um DTO sem ids internos.
 */
export const getPortfolioSnapshot = (filter: ClassFilter = "TODOS") => snapshotFor(filter);

/** Os lançamentos da classe. Com "TODOS", nem lê o catálogo. */
async function transactionsOf(filter: ClassFilter) {
  const transactions = await getMyTransactions();
  if (filter === "TODOS") return transactions;
  const classes = await getAssetClasses(transactions.map((entry) => entry.ticker));
  return byClass(transactions, (ticker) => classes.get(ticker) ?? null, filter);
}

/** Evolução mensal. Completa no Yahoo os fechamentos que faltam (uma vez por mês e ticker). */
export const getEvolution = traced(
  "view.evolution",
  async (filter: ClassFilter = "TODOS"): Promise<EvolutionPoint[]> => {
    await connection();
    const now = new Date();
    const transactions = await transactionsOf(filter);
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
  },
  (points, filter = "TODOS") => ({
    "koinos.view.class_filter": filter,
    "koinos.view.months": points.length,
    "koinos.view.estimated_months": points.filter((point) => point.estimated).length,
  }),
);

/**
 * L/P da semana, do mês e do ano pela cotação das posições abertas. Antes de ler, completa no
 * Yahoo os fechamentos que faltam: o de dezembro do ano passado em diante e os diários recentes
 * (no máximo a cada 12 h por ticker; o cron renova depois do pregão).
 */
export const getPeriodResults = traced(
  "view.period-results",
  async (filter: ClassFilter = "TODOS"): Promise<PeriodResult[]> => {
    await connection();
    const now = new Date();
    const transactions = await transactionsOf(filter);
    const held = replayLedger(transactions).positions.filter((position) => position.quantity > 0);
    if (held.length === 0) return [];
    const tickers = held.map((position) => position.ticker);
    const fromMonth = `${Number(currentMonthKey(now).slice(0, 4)) - 1}-12`;
    await Promise.all([
      // Dezembro do ano passado nunca é depois do mês anterior: cobre as duas referências.
      ensureMonthlyCloses(
        tickers.map((ticker) => ({ ticker, fromMonth })),
        now,
      ),
      ensureRecentCloses(tickers, now),
    ]);
    const [monthlyCloses, assets] = await Promise.all([
      getMonthlyCloses(tickers),
      getAssetSnapshots(tickers),
    ]);
    return periodResults({
      now,
      positions: held.map((position) => ({
        ticker: position.ticker,
        quantity: position.quantity,
        price: assets.get(position.ticker)?.price ?? null,
      })),
      monthlyCloses,
      recentCloses: new Map([...assets].map(([ticker, asset]) => [ticker, asset.recentCloses])),
    });
  },
  (results, filter = "TODOS") => ({
    "koinos.view.class_filter": filter,
    "koinos.view.periods": results.length,
    "koinos.view.missing": results.reduce((sum, result) => sum + result.missing.length, 0),
  }),
);
