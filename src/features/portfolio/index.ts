// API pública pura da feature portfolio (regras e tipos).
export { buildSnapshot } from "./domain/snapshot";
export { computeEvolution } from "./domain/evolution";
export type {
  AllocationSlice,
  ClosedPosition,
  EvolutionPoint,
  PortfolioAlert,
  PortfolioSnapshot,
  PortfolioSummary,
  PositionRow,
  StrategyRow,
} from "./domain/types";
