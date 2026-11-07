// API pública pura da feature independence (a meta de independência financeira, spec v2).
export {
  DEFAULT_HEALTH_LEVEL,
  defaultPlan,
  HEALTH_LEVEL_LABELS,
  isHealthLevel,
} from "./domain/catalog";
export {
  CURRENT_AGE_RANGE,
  DEFAULT_TUITION,
  DEPENDENTS_MAX,
  EDUCATION_INFLATION,
  EDUCATION_UNTIL_OPTIONS,
  EXTERNAL_WEALTH_MAX,
  IMPLIED_MONTHLY_INFLATION,
  NOMINAL_ANNUAL_RETURN,
  PLAN_AMOUNT_MAX,
  REAL_MONTHLY_RATE,
  SPOUSE_AGE_RANGE,
  TARGET_AGE_MAX,
  TUITIONS_PER_YEAR,
  YOUNGEST_AGE_MAX,
  type EducationUntil,
} from "./domain/constants";
export {
  HEALTH_BRACKETS,
  HEALTH_LEVELS,
  healthCost,
  healthPerpetuity,
  healthSteps,
  type HealthLevel,
} from "./domain/health";
export {
  childrenHealthFund,
  durationLabel,
  educationFund,
  independenceSummary,
  monthsToTarget,
  perpetualIncome,
  planTarget,
  requiredAporte,
  targetMonthKey,
} from "./domain/plan";
export { draftFromV1, type PlanV1Fields } from "./domain/migrate";
export { APORTE_MONTHS, averageMonthlyAporte, cashSales, closedMonths } from "./domain/aporte";
export type { IndependencePlan, IndependenceSummary, IndependenceView } from "./domain/types";
