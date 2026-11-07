/**
 * Escala "redonda" para o eixo de um gráfico: o passo é 1, 2, 2,5 ou 5 vezes uma potência de 10,
 * perto de `span ÷ ticks`, e o domínio vai do múltiplo do passo abaixo do menor valor ao múltiplo
 * acima do maior. Com todos os valores iguais, abre um passo para cada lado.
 */
export function niceScale(
  values: readonly number[],
  ticks = 4,
): { domain: [number, number]; ticks: number[]; step: number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rough = (max - min || Math.abs(max) * 0.02 || 1) / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const factor =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  const step = factor * magnitude;
  let low = Math.floor(min / step) * step;
  let high = Math.ceil(max / step) * step;
  if (low === high) {
    low -= step;
    high += step;
  }
  // Arredonda para não acumular sobra de ponto flutuante nos rótulos (0,30000000000000004).
  const round = (value: number) => Number(value.toFixed(10));
  const count = Math.round((high - low) / step);
  return {
    domain: [round(low), round(high)],
    ticks: Array.from({ length: count + 1 }, (_, index) => round(low + index * step)),
    step,
  };
}
