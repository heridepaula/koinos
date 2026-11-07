// API pública pura da feature independence (a meta de independência financeira).
export {
  DEFAULT_ANSWERS,
  defaultPlan,
  HEALTH_OPTIONS,
  LIVING_OPTIONS,
  PEOPLE_MAX,
  PEOPLE_OPTIONS,
  PLAN_AMOUNT_MAX,
  RETENTION_LABELS,
  RETENTION_OPTIONS,
  TRAVEL_OPTIONS,
  type HealthKey,
  type LivingKey,
  type Option,
  type PeopleKey,
  type TravelKey,
} from "./domain/catalog";
export {
  DEFAULT_MONTHLY_YIELD,
  durationLabel,
  grossIncome,
  independenceSummary,
  monthlyNeed,
  monthsToTarget,
  portfolioYield,
  targetMonthKey,
  YIELD_BOUNDS,
} from "./domain/plan";
export { APORTE_MONTHS, averageMonthlyAporte, cashSales, closedMonths } from "./domain/aporte";
export type {
  IndependencePlan,
  IndependenceSummary,
  IndependenceView,
  PlanAnswers,
  YieldSource,
} from "./domain/types";
