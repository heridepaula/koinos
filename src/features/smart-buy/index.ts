// API pública da feature smart-buy (regras puras; os componentes entram na tela de recomendações).
export {
  orderImpact,
  portfolioImpact,
  type ImpactAsset,
  type ImpactKind,
  type ImpactOrder,
  type OrderImpact,
  type PortfolioImpact,
} from "./domain/aporte-impact";
export { splitAmount } from "./domain/aporte-split";
export {
  CURRENT_ENGINE,
  ENGINE_VERSIONS,
  type EngineOptions,
  type EngineVersion,
} from "./domain/engine-options";
export {
  ACCUMULATION,
  DEFAULT_RETENTION,
  fruition,
  MIN_RETENTION,
  splitIncome,
  type FruitionPhase,
  type IncomePhase,
  type IncomeSplit,
} from "./domain/income-phase";
export { mergeOrders, type MergedOrder } from "./domain/merge-orders";
export {
  classifyRisk,
  RISK_CAPS,
  type RiskBuckets,
  type RiskInput,
  type RiskMacro,
} from "./domain/risk";
export { scorecard, type Scorecard } from "./domain/scorecard";
export {
  periodIncome,
  randomPricePaths,
  simulateAportes,
  type PeriodIncome,
  type PricePath,
  type SimulationInput,
  type SimulationParams,
  type SimulationPeriod,
} from "./domain/simulation";
export {
  aportePriorities,
  EXCLUSION_LABELS,
  fiiCascade,
  type AportePriority,
  type CascadeAsset,
  type CascadeExclusion,
  type CascadeLimit,
  type CascadeOrder,
  type CascadeResult,
  type ExclusionReason,
  type PriorityReason,
  type Tensors,
} from "./domain/fii-cascade";
export {
  stockPriorities,
  stockSmartBuy,
  type StockBias,
  type StockBuyAsset,
  type StockBuyOrder,
  type StockBuyResult,
  type StockExclusionReason,
} from "./domain/stock-buy";
