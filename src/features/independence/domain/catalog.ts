import { DEFAULT_RETENTION, MIN_RETENTION } from "@/features/smart-buy";
import type { IndependencePlan } from "./types";

// O questionário da meta (spec 2026-11-07-independencia-financeira §2.1). Os R$ são sugestões:
// cada resposta preenche o campo, e o dono ajusta antes de salvar.

export type Option<K extends string> = {
  key: K;
  label: string;
  detail?: string;
  /** R$ sugerido (ou a quantidade de pessoas, no passo 2). */
  value: number;
};

export const LIVING_OPTIONS = [
  { key: "frugal", label: "Vida frugal", detail: "R$ 3.000 a R$ 5.000", value: 4_000 },
  { key: "conforto", label: "Conforto básico", detail: "R$ 5.000 a R$ 10.000", value: 7_500 },
  { key: "elevado", label: "Padrão elevado", detail: "R$ 10.000 a R$ 15.000", value: 12_500 },
  { key: "alto", label: "Alto padrão", detail: "Acima de R$ 15.000", value: 20_000 },
] as const satisfies readonly Option<string>[];
export type LivingKey = (typeof LIVING_OPTIONS)[number]["key"];

export const PEOPLE_OPTIONS = [
  { key: "eu", label: "Só eu", value: 1 },
  { key: "casal", label: "Eu e meu cônjuge", value: 2 },
  { key: "casal-1", label: "Casal + 1 filho", value: 3 },
  { key: "casal-2", label: "Casal + 2 ou mais filhos", value: 4 },
] as const satisfies readonly Option<string>[];
export type PeopleKey = (typeof PEOPLE_OPTIONS)[number]["key"];

export const HEALTH_OPTIONS = [
  { key: "nenhum", label: "Não preciso", detail: "SUS ou consultas avulsas", value: 0 },
  { key: "basico", label: "Plano Básico", detail: "Enfermaria, cobertura regional", value: 400 },
  {
    key: "conforto",
    label: "Plano Conforto",
    detail: "Apartamento, cobertura nacional",
    value: 800,
  },
  { key: "premium", label: "Plano Premium", detail: "Hospitais de ponta", value: 2_000 },
] as const satisfies readonly Option<string>[];
export type HealthKey = (typeof HEALTH_OPTIONS)[number]["key"];

export const TRAVEL_OPTIONS = [
  { key: "nacional", label: "1 viagem nacional", detail: "Econômica", value: 6_000 },
  {
    key: "moderado",
    label: "2 nacionais ou 1 internacional",
    detail: "Internacional modesta",
    value: 15_000,
  },
  {
    key: "internacional",
    label: "1 a 2 internacionais",
    detail: "Alto padrão",
    value: 36_000,
  },
] as const satisfies readonly Option<string>[];
export type TravelKey = (typeof TRAVEL_OPTIONS)[number]["key"];

/** As retenções da fruição: nunca abaixo do piso de 20% (`MIN_RETENTION`). */
export const RETENTION_OPTIONS = [MIN_RETENTION, DEFAULT_RETENTION, 0.3] as const;

export const RETENTION_LABELS: Record<number, string> = {
  [MIN_RETENTION]: "O mínimo da fruição",
  [DEFAULT_RETENTION]: "Recomendado",
  0.3: "Conservador",
};

/** Teto de cada valor em R$ do plano (o mesmo da action). */
export const PLAN_AMOUNT_MAX = 1_000_000;
export const PEOPLE_MAX = 10;

export const DEFAULT_ANSWERS = {
  living: "conforto",
  people: "eu",
  health: "conforto",
  travel: "moderado",
} as const;

const valueOf = <K extends string>(options: readonly Option<K>[], key: K) =>
  options.find((option) => option.key === key)!.value;

/** O plano das respostas padrão, com os R$ sugeridos. */
export function defaultPlan(): IndependencePlan {
  return {
    answers: { ...DEFAULT_ANSWERS },
    livingCost: valueOf(LIVING_OPTIONS, DEFAULT_ANSWERS.living),
    people: valueOf(PEOPLE_OPTIONS, DEFAULT_ANSWERS.people),
    healthPerPerson: valueOf(HEALTH_OPTIONS, DEFAULT_ANSWERS.health),
    travelPerYear: valueOf(TRAVEL_OPTIONS, DEFAULT_ANSWERS.travel),
    retention: DEFAULT_RETENTION,
  };
}
