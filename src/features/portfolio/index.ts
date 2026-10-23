// API pública pura da feature portfolio (regras e tipos).
export { buildSnapshot } from "./domain/snapshot";
export { computeEvolution } from "./domain/evolution";
export {
  adjustedResult,
  dividendsByTicker,
  groupByMonth,
  groupByTicker,
  groupByYear,
  monthSummary,
  quantityBefore,
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
  splitAporte,
  summarizeReinvestment,
} from "./domain/reinvestment";
export type {
  AdjustedResult,
  AllocationSlice,
  ClosedPosition,
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
