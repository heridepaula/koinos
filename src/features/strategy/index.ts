// API pública da feature strategy para o cliente (regras puras, tipos e schemas).
export { CATEGORIES, CATEGORY_LABELS, suggestCategory, type Category } from "./domain/categories";
export { BIASES, BIAS_LABELS, type Bias } from "./domain/bias";
export {
  effectiveWeights,
  suggestPercentFix,
  type EffectiveWeights,
  type PercentFix,
  type WeightInput,
} from "./domain/weights";
export {
  CEILING_CHECK,
  ceilingCheck,
  ceilingCheckMessage,
  isSuspiciousCeiling,
  marginToCeiling,
  type CeilingCheck,
  type CeilingCheckInput,
} from "./domain/ceiling";
export { targetPatchSchema, type TargetPatchInput } from "./schemas";
