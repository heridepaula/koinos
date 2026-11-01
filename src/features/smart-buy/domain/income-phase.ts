// Fase da carteira e destino dos proventos (spec 2026-11-01-fruicao-design.md). Na acumulação, todo
// provento volta para a carteira. Na fruição (viver de renda), uma fração fica retida e é reinvestida
// pelos mesmos motores, com teto, Aguardar e travas, para proteger a renda da inflação; o resto é o
// que o dono pode gastar. A fase não entra nos motores: ela só decide o valor do aporte.

/** Retenção padrão na fruição: os 25% do estudo debatido na live de Baroni. */
export const DEFAULT_RETENTION = 0.25;

/** Retenção mínima na fruição (o piso de 20% da live): o saque de todo o provento fica barrado. */
export const MIN_RETENTION = 0.2;

export type FruitionPhase = { kind: "FRUICAO"; retention: number };
export type IncomePhase = { kind: "ACUMULACAO" } | FruitionPhase;

export const ACCUMULATION: IncomePhase = { kind: "ACUMULACAO" };

/** A fase de fruição com a retenção dada (fração de 0,20 a 1). Fora disso, RangeError. */
export function fruition(retention: number = DEFAULT_RETENTION): FruitionPhase {
  if (!(retention >= MIN_RETENTION && retention <= 1)) {
    throw new RangeError(
      `A retenção na fruição vai de ${MIN_RETENTION * 100}% a 100% (recebi ${retention}).`,
    );
  }
  return { kind: "FRUICAO", retention };
}

export type IncomeSplit = {
  /** O que volta para a carteira como aporte, em R$. */
  reinvest: number;
  /** O que fica livre para o dono gastar, em R$. */
  consume: number;
};

/**
 * Divide os proventos do período entre reinvestir e gastar, em centavos inteiros. A retenção é
 * arredondada para cima, para nunca reter menos que a fração; as duas partes somam o provento.
 */
export function splitIncome(income: number, phase: IncomePhase): IncomeSplit {
  const cents = Number.isFinite(income) && income > 0 ? Math.round(income * 100) : 0;
  const retention = phase.kind === "ACUMULACAO" ? 1 : phase.retention;
  // O − 1e-9 evita que um produto como 0,24 × 10.000 = 2.400,0000001 suba um centavo.
  if (cents === 0) return { reinvest: 0, consume: 0 };
  const kept = Math.min(cents, Math.ceil(cents * retention - 1e-9));
  return { reinvest: kept / 100, consume: (cents - kept) / 100 };
}
