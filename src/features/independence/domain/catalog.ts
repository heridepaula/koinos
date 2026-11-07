import { DEFAULT_TUITION } from "./constants";
import { HEALTH_LEVELS, type HealthLevel } from "./health";
import type { IndependencePlan } from "./types";

// Os textos e os padrões do questionário (spec 2026-11-07-independencia-financeira-v2 §3).

export const HEALTH_LEVEL_LABELS: Record<HealthLevel, { label: string; detail: string }> = {
  nenhum: { label: "Sem plano particular", detail: "SUS ou consultas avulsas" },
  basico: { label: "Básico", detail: "Enfermaria, cobertura regional" },
  conforto: { label: "Conforto", detail: "Apartamento, cobertura nacional" },
  premium: { label: "Premium", detail: "Hospitais de ponta" },
};

export const DEFAULT_HEALTH_LEVEL: HealthLevel = "conforto";

export const isHealthLevel = (value: unknown): value is HealthLevel =>
  (HEALTH_LEVELS as readonly unknown[]).includes(value);

/** O questionário em branco: os campos em R$ começam em zero, menos a sugestão da escola. */
export function defaultPlan(): IndependencePlan {
  return {
    currentAge: 35,
    targetAge: 50,
    externalWealth: 0,
    essentialMonthly: 0,
    seasonalYearly: 0,
    travelYearly: 0,
    spouseAge: null,
    dependents: 0,
    youngestAge: null,
    educationMonthly: DEFAULT_TUITION,
    educationUntil: 24,
    healthLevel: DEFAULT_HEALTH_LEVEL,
  };
}
