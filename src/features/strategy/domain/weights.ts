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
