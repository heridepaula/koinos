// API pública pura da feature independence (a meta de independência financeira, spec v2).
export {
  DEFAULT_HEALTH_LEVEL,
  defaultPlan,
  HEALTH_LEVEL_LABELS,
  isHealthLevel,
} from "./domain/catalog";
export {
  CONTINGENCY_SHARE,
  CURRENT_AGE_RANGE,
  DEFAULT_TUITION,
  DEPENDENTS_MAX,
  EDUCATION_INFLATION,
  EDUCATION_UNTIL_OPTIONS,
  EXTERNAL_WEALTH_MAX,
  GENERAL_INFLATION,
  NOMINAL_ANNUAL_RETURN,
  PLAN_AMOUNT_MAX,
  REINVESTMENT_SHARE,
  SPOUSE_AGE_RANGE,
  TARGET_AGE_MAX,
  YOUNGEST_AGE_MAX,
  type EducationUntil,
} from "./domain/constants";
export {
  HEALTH_BRACKETS,
  HEALTH_LEVELS,
  healthCost,
  healthSteps,
  type HealthLevel,
} from "./domain/health";
export {
  costsTotal,
  durationLabel,
  firstDayCosts,
  independenceSummary,
  monthlyCostsToday,
  monthlyYieldOf,
  monthsToTarget,
  planTarget,
  requiredAporte,
  targetForLiving,
  targetMonthKey,
  yieldSplit,
} from "./domain/plan";
export { draftFromV1, type PlanV1Fields } from "./domain/migrate";
export { APORTE_MONTHS, averageMonthlyAporte, cashSales, closedMonths } from "./domain/aporte";
export type {
  IndependencePlan,
  IndependenceSummary,
  IndependenceView,
  MonthlyCosts,
  YieldSource,
} from "./domain/types";
