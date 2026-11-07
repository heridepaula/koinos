import { z } from "zod";
import {
  CURRENT_AGE_RANGE,
  DEPENDENTS_MAX,
  EXTERNAL_WEALTH_MAX,
  PLAN_AMOUNT_MAX,
  SPOUSE_AGE_RANGE,
  TARGET_AGE_MAX,
  YOUNGEST_AGE_MAX,
} from "./domain/constants";
import { HEALTH_LEVELS } from "./domain/health";

const money = (max: number) =>
  z
    .number()
    .min(0, "O valor não pode ser negativo")
    .max(max, "Valor alto demais")
    .transform((value) => Math.round(value * 100) / 100);

const age = (min: number, max: number) =>
  z
    .number()
    .int("Idade em anos inteiros")
    .min(min, "Idade fora da faixa")
    .max(max, "Idade fora da faixa");

export const independencePlanSchema = z
  .object({
    currentAge: age(CURRENT_AGE_RANGE.min, CURRENT_AGE_RANGE.max),
    targetAge: age(CURRENT_AGE_RANGE.min, TARGET_AGE_MAX),
    externalWealth: money(EXTERNAL_WEALTH_MAX),
    essentialMonthly: money(PLAN_AMOUNT_MAX),
    seasonalYearly: money(PLAN_AMOUNT_MAX),
    travelYearly: money(PLAN_AMOUNT_MAX),
    spouseAge: age(SPOUSE_AGE_RANGE.min, SPOUSE_AGE_RANGE.max).nullable(),
    dependents: z.number().int().min(0).max(DEPENDENTS_MAX),
    youngestAge: age(0, YOUNGEST_AGE_MAX).nullable(),
    educationMonthly: money(PLAN_AMOUNT_MAX),
    educationUntil: z.union([z.literal(18), z.literal(24)]),
    healthLevel: z.enum(HEALTH_LEVELS),
  })
  .refine((plan) => plan.targetAge >= plan.currentAge, {
    message: "A idade alvo não pode ser menor que a atual",
    path: ["targetAge"],
  })
  .refine((plan) => plan.dependents > 0 === (plan.youngestAge !== null), {
    message: "Informe a idade do dependente mais novo",
    path: ["youngestAge"],
  });
