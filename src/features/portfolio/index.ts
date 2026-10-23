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
  PortfolioAlert,
  PortfolioSnapshot,
  PortfolioSummary,
  PositionRow,
  StrategyRow,
  UpcomingDividend,
} from "./domain/types";
