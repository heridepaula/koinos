// API pública da feature smart-buy (regras puras; os componentes entram na tela de recomendações).
export {
  classifyRisk,
  RISK_CAPS,
  STOCK_CAPS,
  type RiskCaps,
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
  type Tensors,
} from "./domain/suno-cascade";
export {
  DEFAULT_CLASS_TARGET,
  splitByClassTarget,
  type ClassKey,
  type ClassShare,
  type ClassSplit,
  type ClassTarget,
} from "./domain/class-split";
export { classAporte, type ClassAporteResult } from "./domain/class-aporte";
