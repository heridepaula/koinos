// API pública da feature smart-buy (regras puras; os componentes entram na tela de recomendações).
export { splitAmount } from "./domain/aporte-split";
export { mergeOrders, type MergedOrder } from "./domain/merge-orders";
export {
  classifyRisk,
  RISK_CAPS,
  type RiskBuckets,
  type RiskInput,
  type RiskMacro,
} from "./domain/risk";
export {
  aportePriorities,
  EXCLUSION_LABELS,
  sunoCascade,
  type AportePriority,
  type CascadeAsset,
  type CascadeExclusion,
  type CascadeLimit,
  type CascadeOrder,
  type CascadeResult,
  type ExclusionReason,
  type PriorityReason,
  type Tensors,
} from "./domain/suno-cascade";
export {
  stockPriorities,
  stockSmartBuy,
  type StockBias,
  type StockBuyAsset,
  type StockBuyOrder,
  type StockBuyResult,
  type StockExclusionReason,
} from "./domain/stock-buy";
