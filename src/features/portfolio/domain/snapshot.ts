import { assetClassOf, isQuoteStale, type AssetClass } from "@/features/market-data";
import { aportePriorities, classifyRisk, type CascadeAsset } from "@/features/smart-buy";
import {
  effectiveWeights,
  isSuspiciousCeiling,
  marginToCeiling,
  suggestCategory,
} from "@/features/strategy";
import { monthlyContributions, replayLedger, type DividendEntry } from "@/features/transactions";
import { byClass, type ClassFilter } from "@/shared/lib/class-filter";
import { addMonths, currentMonthKey, monthRange } from "@/shared/lib/time";
import { buildAlerts } from "./alerts";
import { allocationByAsset, allocationByCategory } from "./allocation";
import { closedPositions, type ClosedLedgerEntry } from "./closed-positions";
import { adjustedResult, dividendPace, dividendsByTicker } from "./dividends";
import type {
  ClosedPositionRow,
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
  transactions: readonly ClosedLedgerEntry[];
  targets: readonly TargetConfig[];
  /** Proventos recebidos: só afetam o resultado ajustado, não a cascata nem a renda estimada. */
  dividends: readonly DividendEntry[];
  prices: ReadonlyMap<string, PriceInfo>;
  /** Classe de cada ticker pelo catálogo; o que faltar sai pelo código (spec ações, §4). */
  classes: ReadonlyMap<string, AssetClass | null>;
  /** Visão do snapshot (spec etapa 2): decide a estratégia de `strategy` e os alertas. Padrão: Geral. */
  view?: ClassFilter;
};

/**
 * A entrada do snapshot só com a classe pedida (spec etapa 2 das ações, §5). Cada classe tem a sua
 * Carteira Alvo: na visão Ações, só os alvos de ações.
 */
export function scopeToClass(input: SnapshotInput, filter: ClassFilter): SnapshotInput {
  if (filter === "TODOS") return input;
  // A mesma regra do buildSnapshot: o que faltar no mapa sai pelo código.
  const classOf = (ticker: string) =>
    input.classes.has(ticker) ? (input.classes.get(ticker) ?? null) : assetClassOf(ticker, null);
  return {
    ...input,
    transactions: byClass(input.transactions, classOf, filter),
    dividends: byClass(input.dividends, classOf, filter),
    targets: byClass(input.targets, classOf, filter),
    view: filter,
  };
}

export function buildSnapshot({
  now,
  transactions,
  targets,
  dividends,
  prices,
  classes,
  view = "TODOS",
}: SnapshotInput): PortfolioSnapshot {
  const { positions } = replayLedger(transactions);
  const classOf = (ticker: string): AssetClass | null =>
    classes.has(ticker) ? (classes.get(ticker) ?? null) : assetClassOf(ticker, null);
  // A cascata (Recomendações) é só de FIIs; cada classe tem a sua Carteira Alvo.
  const isStock = (ticker: string) => classOf(ticker) === "ACAO";
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

  type StrategyClass = "FII" | "ACAO";
  const classKey = (ticker: string): StrategyClass => (isStock(ticker) ? "ACAO" : "FII");

  // Estratégia de uma classe: os membros, os pesos que fecham 100% dentro dela e o valor.
  const strategyOf = (cls: StrategyClass) => {
    const members = targets.filter(
      (target) => target.inStrategy && classKey(target.ticker) === cls,
    );
    const { weights, sumOfSuggested, warning } = effectiveWeights(
      members.map((member) => ({
        ticker: member.ticker,
        suggestedPercent: member.suggestedPercent,
      })),
    );
    const value = members.reduce((sum, member) => sum + valueOf(member.ticker), 0);
    return {
      members,
      weights,
      sumOfSuggested,
      weightsWarning: warning,
      strategyValue: value,
      weightOf: (ticker: string) => (value > 0 ? valueOf(ticker) / value : 0),
    };
  };
  const strategies = { FII: strategyOf("FII"), ACAO: strategyOf("ACAO") } as const;

  // Entrada do motor 3.0: P/VP e perfil do FII (usebolsai, cron das 2h), proventos (Yahoo) e os
  // baldes de risco. Sem dado, cada tensor fica neutro.
  const toCascadeAsset = (
    member: (typeof strategies.FII.members)[number],
    weights: Map<string, number>,
    stock: boolean,
  ): CascadeAsset => {
    const position = openByTicker.get(member.ticker);
    const info = prices.get(member.ticker);
    const fii = info?.fii ?? null;
    const { macro, sector } = stock
      ? { macro: "Outros" as const, sector: null }
      : classifyRisk({
          fundType: fii?.fundType ?? null,
          segment: fii?.segment ?? null,
          paperPct: fii?.paperPct ?? null,
          realEstatePct: fii?.realEstatePct ?? null,
          category: member.category,
        });
    return {
      ticker: member.ticker,
      rank: member.sunoRank,
      ceiling: member.ceilingPrice,
      weight: weights.get(member.ticker) ?? 0,
      price: priceOf(member.ticker),
      quantity: position?.quantity ?? 0,
      averagePrice: position?.averagePrice ?? null,
      priceToBook: stock ? null : (info?.priceToBook ?? null),
      // O freio de proventos supõe pagador mensal: ação mistura JCP pequeno e dividendo grande,
      // e o freio cortaria o pedido à toa. Nas ações só age a margem até o teto.
      lastDividend: stock ? null : (info?.lastDividend?.amount ?? null),
      dividends12m: stock ? null : (info?.dividends12m ?? null),
      vacancy: !stock && fii?.vacancyPct != null ? fii.vacancyPct / 100 : null,
      macro,
      sector,
    };
  };
  const cascadeInput = strategies.FII.members.map((member) =>
    toCascadeAsset(member, strategies.FII.weights, false),
  );
  // Carteira de ações (spec aporte por classe, §4.5): só a margem até o teto age.
  const stockCascadeInput = strategies.ACAO.members.map((member) =>
    toCascadeAsset(member, strategies.ACAO.weights, true),
  );
  // Patrimônio de cada classe, para repartir o aporte entre elas.
  const classValues = { FII: 0, ACAO: 0 };
  for (const position of open) classValues[classKey(position.ticker)] += valueOf(position.ticker);
  const priorities = aportePriorities(cascadeInput);

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
  const pace = dividendPace(now, dividends);
  const summary: PortfolioSummary = {
    patrimony,
    invested,
    pnl: patrimony - invested,
    pnlPct: invested > 0 ? (patrimony - invested) / invested : null,
    realizedPnL,
    dividendsReceived,
    dividendPace: pace,
    pnlWithDividends: portfolioAdjusted.withDividends,
    totalResult: portfolioAdjusted.total,
    dayChange,
    dayChangePct: patrimony - dayChange > 0 ? dayChange / (patrimony - dayChange) : null,
    dy12m: dyBase > 0 ? dyWeighted / dyBase : null,
    monthlyIncome,
    yieldOnCost: invested > 0 ? (monthlyIncome * 12) / invested : null,
    incomeVsAverage:
      monthlyIncome > 0 && pace.monthlyAverage12m > 0
        ? monthlyIncome / pace.monthlyAverage12m - 1
        : null,
    positionsCount: open.length,
  };

  // Tabela de posições.
  const positionRows: PositionRow[] = open
    .map((position) => {
      const info = prices.get(position.ticker);
      const target = targetByTicker.get(position.ticker);
      const price = info?.price ?? null;
      const value = valueOf(position.ticker);
      const stock = isStock(position.ticker);
      const strategy = strategies[classKey(position.ticker)];
      const inStrategy = target?.inStrategy ?? false;
      const pnl = value - position.totalCost;
      const dividendsOf = received.get(position.ticker) ?? 0;
      const adjusted = adjustedResult(pnl, dividendsOf, position.realizedPnL);
      return {
        ticker: position.ticker,
        assetClass: classOf(position.ticker),
        name: info?.name ?? null,
        logoUrl: info?.logoUrl ?? null,
        // A ação não tem configuração na Carteira Alvo: a categoria vem da classe.
        category: stock ? "ACAO" : (target?.category ?? null),
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
        strategyWeight: inStrategy ? strategy.weightOf(position.ticker) : null,
        targetWeight: inStrategy ? (strategy.weights.get(position.ticker) ?? 0) : null,
        priority: inStrategy ? (priorities.get(position.ticker) ?? null) : null,
      };
    })
    .sort((a, b) => b.currentValue - a.currentValue);

  // Carteira Alvo: tudo o que está em carteira ou configurado, por classe. As cotações vencidas
  // contam todos os ativos.
  const quoteTickers = [
    ...new Set([...open.map((p) => p.ticker), ...targets.map((t) => t.ticker)]),
  ];
  const rowsOf = (cls: StrategyClass): StrategyRow[] => {
    const strategy = strategies[cls];
    return quoteTickers
      .filter((ticker) => classKey(ticker) === cls)
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
          category: cls === "ACAO" ? "ACAO" : (target?.category ?? null),
          suggestedCategory: cls === "ACAO" ? "ACAO" : suggestCategory(info?.subType ?? null),
          price,
          marginToCeiling: marginToCeiling(target?.ceilingPrice ?? null, price),
          suspiciousCeiling: isSuspiciousCeiling(target?.ceilingPrice ?? null, price),
          strategyWeight: inStrategy ? strategy.weightOf(ticker) : null,
          targetWeight: inStrategy ? (strategy.weights.get(ticker) ?? 0) : null,
          priority: inStrategy ? (priorities.get(ticker) ?? null) : null,
        };
      })
      .sort(
        (a, b) =>
          Number(b.inStrategy) - Number(a.inStrategy) ||
          (a.sunoRank ?? Infinity) - (b.sunoRank ?? Infinity) ||
          a.ticker.localeCompare(b.ticker),
      );
  };
  const viewClass: StrategyClass = view === "ACAO" ? "ACAO" : "FII";
  const alertClasses: StrategyClass[] = view === "TODOS" ? ["FII", "ACAO"] : [viewClass];
  const rowsByClass = { FII: rowsOf("FII"), ACAO: rowsOf("ACAO") };

  // Encerradas: as posições zeradas e os FIIs que só aparecem pelos proventos (sem lançamento),
  // para o total de proventos do resumo fechar com a soma das linhas das duas tabelas.
  const ledgerTickers = new Set(positions.map((position) => position.ticker));
  const timeOf = (date: Date | null) => date?.getTime() ?? 0;
  const closed: ClosedPositionRow[] = [
    ...closedPositions(transactions, classes).map((position) => {
      const dividendsOf = received.get(position.ticker) ?? 0;
      return {
        ticker: position.ticker,
        assetClass: classOf(position.ticker),
        realizedPnL: position.realizedPnL,
        dividends: dividendsOf,
        // Posição zerada: não há resultado de cotação, só vendas e proventos.
        totalResult: adjustedResult(0, dividendsOf, position.realizedPnL).total,
        closedAt: position.closedAt,
      };
    }),
    ...[...received]
      .filter(([ticker]) => !ledgerTickers.has(ticker))
      .map(([ticker, amount]) => ({
        ticker,
        assetClass: classOf(ticker),
        realizedPnL: 0,
        dividends: amount,
        totalResult: adjustedResult(0, amount, 0).total,
        closedAt: null,
      })),
  ].sort((a, b) => timeOf(b.closedAt) - timeOf(a.closedAt) || a.ticker.localeCompare(b.ticker));

  const nowMonth = currentMonthKey(now);
  const fetchedTimes = quoteTickers
    .map((ticker) => prices.get(ticker)?.quoteFetchedAt?.getTime())
    .filter((time): time is number => time !== undefined);

  return {
    summary,
    positions: positionRows,
    closed,
    strategy: {
      rows: rowsByClass[viewClass],
      strategyValue: strategies[viewClass].strategyValue,
      sumOfSuggested: strategies[viewClass].sumOfSuggested,
      weightsWarning: strategies[viewClass].weightsWarning,
    },
    cascadeInput,
    stockCascadeInput,
    stockStrategyMeta: rowsByClass.ACAO.map((row) => ({
      ticker: row.ticker,
      name: row.name,
      logoUrl: row.logoUrl,
    })),
    classValues,
    allocation: {
      byCategory: allocationByCategory(positionRows),
      byAsset: allocationByAsset(positionRows),
    },
    contributions: monthlyContributions(
      transactions,
      monthRange(addMonths(nowMonth, -(CONTRIBUTION_MONTHS - 1)), nowMonth),
    ),
    alerts: buildAlerts({
      positions: positionRows,
      strategies: alertClasses.map((cls) => ({
        rows: rowsByClass[cls],
        weightsWarning: strategies[cls].weightsWarning,
        tag: cls === "ACAO" && view === "TODOS" ? { id: "acoes", label: "ações" } : null,
        receivesAporte: cls === "FII",
      })),
    }),
    quotes: {
      staleCount: quoteTickers.filter((ticker) =>
        isQuoteStale(prices.get(ticker)?.quoteFetchedAt, now),
      ).length,
      lastFetchedAt: fetchedTimes.length > 0 ? new Date(Math.max(...fetchedTimes)) : null,
    },
  };
}
