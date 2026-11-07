// As constantes da meta (spec 2026-11-07-independencia-financeira-v2 §2.1). Sem tela para mudar.

/** Taxa de retorno real mensal (≈ 4,91% a.a. acima da inflação). */
export const REAL_MONTHLY_RATE = 0.004;
/** Inflação da educação, ao ano (≈ IPCA + 3%). */
export const EDUCATION_INFLATION = 0.08;
/** Rendimento nominal da carteira, ao ano: desconta a escola. Com a taxa real, implica IPCA ≈ 4,38%. */
export const NOMINAL_ANNUAL_RETURN = 0.095;
/**
 * Inflação mensal implícita nas duas taxas acima: o rendimento nominal (9,5% a.a.) sobre a taxa
 * real (0,4% a.m.), ≈ 0,358% a.m. (≈ 4,38% a.a.). É o que a meta reinveste por mês para não perder
 * para a inflação (spec v2 §2.7).
 */
export const IMPLIED_MONTHLY_INFLATION =
  (1 + NOMINAL_ANNUAL_RETURN) ** (1 / 12) / (1 + REAL_MONTHLY_RATE) - 1;
/** Mensalidades de escola por ano: 12 meses + matrícula e material. */
export const TUITIONS_PER_YEAR = 13;

/** Teto de cada valor em R$ do plano. */
export const PLAN_AMOUNT_MAX = 1_000_000;
/** Teto do patrimônio fora do Koinos. */
export const EXTERNAL_WEALTH_MAX = 100_000_000;
export const CURRENT_AGE_RANGE = { min: 18, max: 80 } as const;
export const TARGET_AGE_MAX = 90;
export const SPOUSE_AGE_RANGE = { min: 18, max: 90 } as const;
export const YOUNGEST_AGE_MAX = 30;
export const DEPENDENTS_MAX = 10;
/** Até que idade os dependentes são custeados: fim do ensino médio ou da faculdade. */
export const EDUCATION_UNTIL_OPTIONS = [18, 24] as const;
export type EducationUntil = (typeof EDUCATION_UNTIL_OPTIONS)[number];
/** Sugestão de mensalidade de escola, cursos e van. */
export const DEFAULT_TUITION = 2_500;
