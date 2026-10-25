// Quarentena: um FII fora da estratégia, que não recebe mais aporte. 0% marca isso, então 0% só
// vale fora dela. Na estratégia, a % vazia divide o que falta para 100%.

export const ZERO_PERCENT_IN_STRATEGY =
  "0% só vale fora da estratégia (quarentena). Na estratégia, deixe a % vazia para dividir o que falta.";

/** O motivo de recusar a % sugerida, ou null se ela vale. */
export const suggestedPercentProblem = (percent: number | null, inStrategy: boolean) =>
  percent === 0 && inStrategy ? ZERO_PERCENT_IN_STRATEGY : null;
