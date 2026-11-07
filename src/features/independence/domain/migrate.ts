import { defaultPlan, isHealthLevel } from "./catalog";
import type { IndependencePlan } from "./types";

/** Os campos de um plano da v1 que ainda servem (spec v2 §4). */
export type PlanV1Fields = {
  livingCost?: unknown;
  travelPerYear?: unknown;
  answers?: { health?: unknown } | null;
};

const money = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;

/** O rascunho do questionário a partir de um plano v1: gasto fixo, viagens e o padrão de saúde. */
export function draftFromV1(old: PlanV1Fields): IndependencePlan {
  const draft = defaultPlan();
  const health = old.answers?.health;
  return {
    ...draft,
    essentialMonthly: money(old.livingCost),
    travelYearly: money(old.travelPerYear),
    healthLevel: isHealthLevel(health) ? health : draft.healthLevel,
  };
}
