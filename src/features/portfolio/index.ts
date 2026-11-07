// API pública pura da feature portfolio (regras e tipos).
export { buildSnapshot, scopeToClass } from "./domain/snapshot";
export { computeEvolution } from "./domain/evolution";
export {
  closedPositions,
  estimateCapitalGainsTax,
  FII_CAPITAL_GAINS_RATE,
  summarizeClosedPositions,
  type ClosedLedgerEntry,
} from "./domain/closed-positions";
export {
  adjustedResult,
  dividendsByTicker,
  groupByMonth,
  groupByTicker,
  groupByYear,
  monthSummary,
  parseKindParam,
  quantityBefore,
  sumByKind,
  upcomingDividends,
} from "./domain/dividends";
export {
  DEFAULT_REINVESTMENT_PERCENT,
  isReportMonth,
  MONTH_KEY_PATTERN,
  monthPurchases,
  reinvestmentHistory,
  reinvestmentMonths,
  roundPercent,
  shareReinvestment,
  splitAporte,
  summarizeReinvestment,
} from "./domain/reinvestment";
export { dayMovers, DAY_MOVERS_LIMIT } from "./domain/day-movers";
export type {
  DayMover,
  DayMovers,
  AdjustedResult,
  AllocationSlice,
  ClosedPosition,
  ClosedPositionRow,
  ClosedPositionsTotals,
  ClosedPositionsView,
  DividendMonthGroup,
  DividendMonthSummary,
  DividendsView,
  DividendTickerGroup,
  DividendYearGroup,
  EvolutionPoint,
  MonthPurchase,
  PortfolioAlert,
  PortfolioSnapshot,
  PortfolioSummary,
  PositionRow,
  ReinvestmentMonth,
  ReinvestmentSplit,
  ReinvestmentView,
  StrategyRow,
  UpcomingDividend,
} from "./domain/types";
