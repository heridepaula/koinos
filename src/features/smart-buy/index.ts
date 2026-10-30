// API pública da feature smart-buy (regras puras; os componentes entram na tela de recomendações).
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
  type Tensors,
} from "./domain/suno-cascade";
