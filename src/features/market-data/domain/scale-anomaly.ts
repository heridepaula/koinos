/**
 * Erro de escala num valor lido de fora (um provento de 1500 onde o histórico é 1,50): o decimal
 * deslocado ou o texto de outra coluna. Só sinaliza; quem chama registra no log e segue o lote, e
 * decide se o valor entra (um desdobro ou um provento extra de verdade também muda a escala).
 */

/** Uma ordem de grandeza: abaixo disso, a variação cabe em provento extra ou em reajuste. */
export const SCALE_ANOMALY_FACTOR = 10;
/** Sem esse mínimo de valores no histórico, a mediana não diz nada. */
export const SCALE_ANOMALY_MIN_SAMPLES = 3;

export type ScaleAnomaly = {
  /** Mediana dos valores positivos do histórico. */
  reference: number;
  /** valor ÷ referência. */
  ratio: number;
};

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

/**
 * Compara o valor com a mediana do histórico. Null quando está na escala, quando o valor não é
 * um número positivo ou quando o histórico (só os positivos e finitos contam) é curto demais.
 */
export function detectScaleAnomaly(
  value: number,
  history: readonly number[],
  factor = SCALE_ANOMALY_FACTOR,
): ScaleAnomaly | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const usable = history.filter((item) => Number.isFinite(item) && item > 0);
  if (usable.length < SCALE_ANOMALY_MIN_SAMPLES) return null;
  const reference = median(usable);
  const ratio = value / reference;
  return ratio >= factor || ratio <= 1 / factor ? { reference, ratio } : null;
}
