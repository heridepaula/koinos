// As constantes da meta (spec 2026-11-07-independencia-financeira-v2 §2.1 e §10). Sem tela para
// mudar.

/** Inflação da educação, ao ano (≈ IPCA + 3%): leva a escola de hoje até a idade alvo. */
export const EDUCATION_INFLATION = 0.08;
/** Rendimento de referência da carteira, ao ano, enquanto ela ainda não tem DY. */
export const NOMINAL_ANNUAL_RETURN = 0.095;
/**
 * Inflação geral ao ano (≈ 4,37%): a da v2, que separava esses 9,5% nominais de 0,4% a.m. reais.
 * Leva os custos de hoje até o primeiro dia da aposentadoria (§10).
 */
export const GENERAL_INFLATION = (1 + NOMINAL_ANNUAL_RETURN) / Math.pow(1.004, 12) - 1;
/**
 * Folga para imprevistos sobre o gasto essencial (pedido do dono, 2026-11-07): o essencial com ela
 * é o que a meta deixa livre para viver.
 */
export const CONTINGENCY_SHARE = 0.3;
/**
 * A regra dos 24% (pedido do dono, 2026-11-07): do que a meta recebe por mês, 24% voltam para a
 * carteira, para repor a inflação, e 76% pagam o mês.
 */
export const REINVESTMENT_SHARE = 0.24;

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
