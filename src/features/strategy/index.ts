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
  CEILING_MAX,
  calculatedCeiling,
  ceilingCheck,
  ceilingFromInput,
  ceilingCheckDetails,
  isSuspiciousCeiling,
  marginToCeiling,
  type CalculatedCeiling,
  type CeilingCheck,
  type CeilingCheckDetails,
  type CeilingCheckInput,
  type CeilingCheckRow,
} from "./domain/ceiling";
export { targetPatchSchema, type TargetPatchInput } from "./schemas";
