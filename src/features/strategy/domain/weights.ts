import { formatPercent } from "@/shared/lib/format";

export type WeightInput = { ticker: string; suggestedPercent: number | null };

export type EffectiveWeights = {
  /** Peso de cada ativo da estratégia, como fração (soma 1). */
  weights: Map<string, number>;
  sumOfSuggested: number;
  warning: string | null;
};

/**
 * Pesos efetivos da estratégia:
 * - sem nenhuma % sugerida, peso igual para todos;
 * - com algumas, o que falta para 100% é dividido igualmente entre os ativos sem %;
 * - no fim, tudo é normalizado para somar 100%.
 */
export function effectiveWeights(items: readonly WeightInput[]): EffectiveWeights {
  if (items.length === 0) return { weights: new Map(), sumOfSuggested: 0, warning: null };

  const withPercent = items.filter((item) => item.suggestedPercent !== null);
  const withoutPercent = items.filter((item) => item.suggestedPercent === null);
  const sumOfSuggested = withPercent.reduce((sum, item) => sum + item.suggestedPercent!, 0);

  const raw = new Map<string, number>();
  if (withPercent.length === 0) {
    for (const item of items) raw.set(item.ticker, 1);
  } else {
    const rest = Math.max(0, 100 - sumOfSuggested);
    for (const item of withPercent) raw.set(item.ticker, item.suggestedPercent!);
    for (const item of withoutPercent) raw.set(item.ticker, rest / withoutPercent.length);
  }

  const rawTotal = [...raw.values()].reduce((sum, value) => sum + value, 0);
  const weights = new Map(
    [...raw].map(([ticker, value]) => [ticker, rawTotal > 0 ? value / rawTotal : 1 / items.length]),
  );

  const sumText = formatPercent(sumOfSuggested / 100, 1);
  let warning: string | null = null;
  if (sumOfSuggested > 100.0001) {
    warning = `As % sugeridas somam ${sumText}. Foram ajustadas proporcionalmente para 100%.`;
  } else if (withoutPercent.length === 0 && Math.abs(sumOfSuggested - 100) > 0.0001) {
    warning = `As % sugeridas somam ${sumText}. Foram ajustadas proporcionalmente para 100%.`;
  } else if (withPercent.length > 0 && withoutPercent.length > 0) {
    warning = `${withoutPercent.length} ativo(s) sem % sugerida dividem igualmente o que falta para 100%.`;
  }
  return { weights, sumOfSuggested, warning };
}

export type PercentFix = { ticker: string; from: number | null; to: number };

/** Divide `total` décimos entre os pesos pelo maior resto: a soma fecha exata, e ninguém fica com zero. */
function splitTenths(weights: readonly number[], total: number): number[] {
  const sum = weights.reduce((acc, value) => acc + value, 0);
  const exact = weights.map((value) => (sum > 0 ? (value / sum) * total : total / weights.length));
  const result = exact.map((value) => Math.max(1, Math.floor(value)));
  let left = total - result.reduce((acc, value) => acc + value, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (let step = 0; left > 0; step++, left--)
    result[byRemainder[step % byRemainder.length].index]++;
  // O mínimo de 1 décimo pode passar do total: tira dos maiores.
  while (left < 0) {
    const largest = result.indexOf(Math.max(...result));
    result[largest]--;
    left++;
  }
  return result;
}

/**
 * Ajuste sugerido para as % da estratégia somarem 100%, com uma casa decimal. Null se já somam.
 * - Com ativos sem % e soma abaixo de 100%, o que falta é dividido igualmente entre eles (como
 *   `effectiveWeights` já faz no cálculo).
 * - Nos outros casos, as % existentes são ajustadas proporcionalmente.
 */
export function suggestPercentFix(items: readonly WeightInput[]): PercentFix[] | null {
  const withPercent = items.filter((item) => item.suggestedPercent !== null);
  const withoutPercent = items.filter((item) => item.suggestedPercent === null);
  if (withPercent.length === 0) return null;
  const tenths = withPercent.reduce(
    (sum, item) => sum + Math.round(item.suggestedPercent! * 10),
    0,
  );
  if (tenths === 1000) return null;

  if (withoutPercent.length > 0 && tenths < 1000) {
    const shares = splitTenths(
      withoutPercent.map(() => 1),
      1000 - tenths,
    );
    return withoutPercent.map((item, index) => ({
      ticker: item.ticker,
      from: null,
      to: shares[index] / 10,
    }));
  }
  const shares = splitTenths(
    withPercent.map((item) => item.suggestedPercent!),
    1000,
  );
  return withPercent
    .map((item, index) => ({
      ticker: item.ticker,
      from: item.suggestedPercent,
      to: shares[index] / 10,
    }))
    .filter((fix) => Math.abs(fix.to - fix.from!) > 1e-9);
}
