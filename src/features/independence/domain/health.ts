// Plano de saúde por faixa etária (spec 2026-11-07-independencia-financeira-v2 §2.2): o ponto médio
// de cada faixa do levantamento de 2026 do dono (plano individual, PF, São Paulo), por pessoa.

export const HEALTH_LEVELS = ["nenhum", "basico", "conforto", "premium"] as const;
export type HealthLevel = (typeof HEALTH_LEVELS)[number];

type Bracket = { from: number; basico: number; conforto: number; premium: number };

/** As faixas da ANS, da mais nova à mais velha. O Premium de 39–43 é o R$ 850 da v2. */
export const HEALTH_BRACKETS: readonly Bracket[] = [
  { from: 0, basico: 180, conforto: 290, premium: 425 },
  { from: 19, basico: 220, conforto: 350, premium: 510 },
  { from: 24, basico: 255, conforto: 400, premium: 600 },
  { from: 29, basico: 285, conforto: 455, premium: 690 },
  { from: 34, basico: 310, conforto: 500, premium: 750 },
  { from: 39, basico: 350, conforto: 550, premium: 850 },
  { from: 44, basico: 460, conforto: 735, premium: 1_125 },
  { from: 49, basico: 565, conforto: 880, premium: 1_375 },
  { from: 54, basico: 765, conforto: 1_200, premium: 1_850 },
  { from: 59, basico: 1_085, conforto: 1_725, premium: 2_850 },
];

const costOf = (bracket: Bracket, level: HealthLevel) => (level === "nenhum" ? 0 : bracket[level]);

/** A mensalidade por pessoa na faixa da idade. */
export function healthCost(level: HealthLevel, age: number): number {
  let found = HEALTH_BRACKETS[0]!;
  for (const bracket of HEALTH_BRACKETS) if (bracket.from <= age) found = bracket;
  return costOf(found, level);
}

/** Os aumentos de faixa depois da idade: a idade em que começam e a nova mensalidade. */
export function healthSteps(level: HealthLevel, age: number): { age: number; cost: number }[] {
  if (level === "nenhum") return [];
  return HEALTH_BRACKETS.filter((bracket) => bracket.from > age).map((bracket) => ({
    age: bracket.from,
    cost: costOf(bracket, level),
  }));
}
