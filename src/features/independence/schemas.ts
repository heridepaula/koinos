import { z } from "zod";
import {
  HEALTH_OPTIONS,
  LIVING_OPTIONS,
  PEOPLE_MAX,
  PEOPLE_OPTIONS,
  PLAN_AMOUNT_MAX,
  RETENTION_OPTIONS,
  TRAVEL_OPTIONS,
} from "./domain/catalog";

const keysOf = <K extends string>(options: readonly { key: K }[]) =>
  options.map((option) => option.key) as [K, ...K[]];

const amount = z
  .number()
  .min(0, "O valor não pode ser negativo")
  .max(PLAN_AMOUNT_MAX, "Valor alto demais")
  .transform((value) => Math.round(value * 100) / 100);

export const independencePlanSchema = z.object({
  answers: z.object({
    living: z.enum(keysOf(LIVING_OPTIONS)),
    people: z.enum(keysOf(PEOPLE_OPTIONS)),
    health: z.enum(keysOf(HEALTH_OPTIONS)),
    travel: z.enum(keysOf(TRAVEL_OPTIONS)),
  }),
  livingCost: amount,
  people: z.number().int("Pessoas é um número inteiro").min(1).max(PEOPLE_MAX),
  healthPerPerson: amount,
  travelPerYear: amount,
  retention: z
    .number()
    .refine(
      (value) => (RETENTION_OPTIONS as readonly number[]).includes(value),
      "Escolha 20%, 25% ou 30%",
    ),
});
