import { isQuoteStale } from "@/features/market-data";
import { aportePriorities, type CascadeAsset } from "@/features/smart-buy";
import {
  effectiveWeights,
  isSuspiciousCeiling,
  marginToCeiling,
  suggestCategory,
} from "@/features/strategy";
import {
  monthlyContributions,
  replayLedger,
  type DividendEntry,
  type LedgerEntry,
} from "@/features/transactions";
import { addMonths, currentMonthKey, monthRange } from "@/shared/lib/time";
import { buildAlerts } from "./alerts";
import { allocationByAsset, allocationByCategory } from "./allocation";
import { adjustedResult, dividendsByTicker } from "./dividends";
import type {
  PortfolioSnapshot,
  PortfolioSummary,
  PositionRow,
  PriceInfo,
  StrategyRow,
  TargetConfig,
} from "./types";

const DIVIDEND_RECENCY_MS = 62 * 86_400_000;
const CONTRIBUTION_MONTHS = 24;

export type SnapshotInput = {
  now: Date;
  transactions: readonly LedgerEntry[];
  targets: readonly TargetConfig[];
  /** Proventos recebidos: só afetam o resultado ajustado, não a cascata nem a renda estimada. */
  dividends: readonly DividendEntry[];
  prices: ReadonlyMap<string, PriceInfo>;
};

export function buildSnapshot({
  now,
  transactions,
  targets,
  dividends,
  prices,
}: SnapshotInput): PortfolioSnapshot {
  const { positions } = replayLedger(transactions);
  const received = dividendsByTicker(dividends);
  const open = positions.filter((position) => position.quantity > 0);
  const openByTicker = new Map(open.map((position) => [position.ticker, position]));
  const targetByTicker = new Map(targets.map((target) => [target.ticker, target]));

  const priceOf = (ticker: string) => prices.get(ticker)?.price ?? null;
  const valueOf = (ticker: string) => {
    const position = openByTicker.get(ticker);
    if (!position) return 0;
    return position.quantity * (priceOf(ticker) ?? position.averagePrice);
  };

  // Estratégia: ativos com inStrategy, em carteira ou não.
  const members = targets.filter((target) => target.inStrategy);
  const {
    weights,
    sumOfSuggested,
    warning: weightsWarning,
  } = effectiveWeights(
    members.map((member) => ({ ticker: member.ticker, suggestedPercent: member.suggestedPercent })),
  );
  const cascadeInput: CascadeAsset[] = members.map((member) => {
    const position = openByTicker.get(member.ticker);
    return {
      ticker: member.ticker,
      rank: member.sunoRank,
      ceiling: member.ceilingPrice,
      weight: weights.get(member.ticker) ?? 0,
      price: priceOf(member.ticker),
      quantity: position?.quantity ?? 0,
      averagePrice: position?.averagePrice ?? null,
    };
  });
  const priorities = aportePriorities(cascadeInput);
  const strategyValue = members.reduce((sum, member) => sum + valueOf(member.ticker), 0);
  const strategyWeightOf = (ticker: string) =>
    strategyValue > 0 ? valueOf(ticker) / strategyValue : 0;

  // Resumo.
  const patrimony = open.reduce((sum, position) => sum + valueOf(position.ticker), 0);
  const invested = open.reduce((sum, position) => sum + position.totalCost, 0);
  let dayChange = 0;
  let dyWeighted = 0;
  let dyBase = 0;
  let monthlyIncome = 0;
  for (const position of open) {
    const info = prices.get(position.ticker);
    const value = valueOf(position.ticker);
    if (info?.changePercent != null && info.price !== null) {
      dayChange += value - value / (1 + info.changePercent);
    }
    if (info?.dy12m != null) {
      dyWeighted += value * info.dy12m;
      dyBase += value;
    }
    if (
      info?.lastDividend &&
      now.getTime() - info.lastDividend.exDate.getTime() <= DIVIDEND_RECENCY_MS
    ) {
      monthlyIncome += position.quantity * info.lastDividend.amount;
    }
  }
  // Resultado ajustado da carteira: inclui os proventos de todos os FIIs, abertos ou encerrados.
  const realizedPnL = positions.reduce((sum, position) => sum + position.realizedPnL, 0);
  const dividendsReceived = [...received.values()].reduce((sum, value) => sum + value, 0);
  const portfolioAdjusted = adjustedResult(patrimony - invested, dividendsReceived, realizedPnL);
  const summary: PortfolioSummary = {
    patrimony,
    invested,
    pnl: patrimony - invested,
    pnlPct: invested > 0 ? (patrimony - invested) / invested : null,
    realizedPnL,
    dividendsReceived,
    pnlWithDividends: portfolioAdjusted.withDividends,
    totalResult: portfolioAdjusted.total,
    dayChange,
    dayChangePct: patrimony - dayChange > 0 ? dayChange / (patrimony - dayChange) : null,
    dy12m: dyBase > 0 ? dyWeighted / dyBase : null,
    monthlyIncome,
    positionsCount: open.length,
  };

  // Tabela de posições.
  const positionRows: PositionRow[] = open
    .map((position) => {
      const info = prices.get(position.ticker);
      const target = targetByTicker.get(position.ticker);
      const price = info?.price ?? null;
      const value = valueOf(position.ticker);
      const inStrategy = target?.inStrategy ?? false;
      const pnl = value - position.totalCost;
      const dividendsOf = received.get(position.ticker) ?? 0;
      const adjusted = adjustedResult(pnl, dividendsOf, position.realizedPnL);
      return {
        ticker: position.ticker,
        name: info?.name ?? null,
        logoUrl: info?.logoUrl ?? null,
        category: target?.category ?? null,
        quantity: position.quantity,
        averagePrice: position.averagePrice,
        totalCost: position.totalCost,
        price,
        currentValue: value,
        pnl,
        pnlPct: position.totalCost > 0 ? (value - position.totalCost) / position.totalCost : null,
        dividends: dividendsOf,
        pnlWithDividends: adjusted.withDividends,
        totalResult: adjusted.total,
        realizedPnL: position.realizedPnL,
        changePercent: info?.changePercent ?? null,
        dy12m: info?.dy12m ?? null,
        portfolioWeight: patrimony > 0 ? value / patrimony : 0,
        inStrategy,
        sunoRank: target?.sunoRank ?? null,
        ceilingPrice: target?.ceilingPrice ?? null,
        marginToCeiling: marginToCeiling(target?.ceilingPrice ?? null, price),
        suspiciousCeiling: isSuspiciousCeiling(target?.ceilingPrice ?? null, price),
        strategyWeight: inStrategy ? strategyWeightOf(position.ticker) : null,
        targetWeight: inStrategy ? (weights.get(position.ticker) ?? 0) : null,
        priority: inStrategy ? (priorities.get(position.ticker) ?? null) : null,
      };
    })
    .sort((a, b) => b.currentValue - a.currentValue);

  // Carteira Alvo: tudo o que está em carteira ou configurado.
  const strategyTickers = [
    ...new Set([...open.map((p) => p.ticker), ...targets.map((t) => t.ticker)]),
  ];
  const strategyRows: StrategyRow[] = strategyTickers
    .map((ticker) => {
      const target = targetByTicker.get(ticker);
      const info = prices.get(ticker);
      const price = info?.price ?? null;
      const inStrategy = target?.inStrategy ?? false;
      return {
        ticker,
        name: info?.name ?? null,
        logoUrl: info?.logoUrl ?? null,
        configured: Boolean(target),
        held: openByTicker.has(ticker),
        quantity: openByTicker.get(ticker)?.quantity ?? 0,
        inStrategy,
        sunoRank: target?.sunoRank ?? null,
        ceilingPrice: target?.ceilingPrice ?? null,
        suggestedPercent: target?.suggestedPercent ?? null,
        category: target?.category ?? null,
        suggestedCategory: suggestCategory(info?.subType ?? null),
        price,
        marginToCeiling: marginToCeiling(target?.ceilingPrice ?? null, price),
        suspiciousCeiling: isSuspiciousCeiling(target?.ceilingPrice ?? null, price),
        strategyWeight: inStrategy ? strategyWeightOf(ticker) : null,
        targetWeight: inStrategy ? (weights.get(ticker) ?? 0) : null,
        priority: inStrategy ? (priorities.get(ticker) ?? null) : null,
      };
    })
    .sort(
      (a, b) =>
        Number(b.inStrategy) - Number(a.inStrategy) ||
        (a.sunoRank ?? Infinity) - (b.sunoRank ?? Infinity) ||
        a.ticker.localeCompare(b.ticker),
    );

  const nowMonth = currentMonthKey(now);
  const quoteTickers = strategyTickers;
  const fetchedTimes = quoteTickers
    .map((ticker) => prices.get(ticker)?.quoteFetchedAt?.getTime())
    .filter((time): time is number => time !== undefined);

  return {
    summary,
    positions: positionRows,
    closed: positions
      .filter((position) => position.quantity === 0)
      .map((position) => {
        const dividendsOf = received.get(position.ticker) ?? 0;
        return {
          ticker: position.ticker,
          realizedPnL: position.realizedPnL,
          dividends: dividendsOf,
          // Posição zerada: não há resultado de cotação, só vendas e proventos.
          totalResult: adjustedResult(0, dividendsOf, position.realizedPnL).total,
          lastDate: position.lastDate,
        };
      })
      .sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime()),
    strategy: { rows: strategyRows, strategyValue, sumOfSuggested, weightsWarning },
    cascadeInput,
    allocation: {
      byCategory: allocationByCategory(positionRows),
      byAsset: allocationByAsset(positionRows),
    },
    contributions: monthlyContributions(
      transactions,
      monthRange(addMonths(nowMonth, -(CONTRIBUTION_MONTHS - 1)), nowMonth),
    ),
    alerts: buildAlerts({ positions: positionRows, strategyRows, weightsWarning }),
    quotes: {
      staleCount: quoteTickers.filter((ticker) =>
        isQuoteStale(prices.get(ticker)?.quoteFetchedAt, now),
      ).length,
      lastFetchedAt: fetchedTimes.length > 0 ? new Date(Math.max(...fetchedTimes)) : null,
    },
  };
}
