/** "2026-11-06" vira "06/11" (eixo e textos curtos do gráfico de cotação). */
export function formatDayKey(key: string): string {
  const [, month, day] = key.split("-");
  return `${day}/${month}`;
}

/** "2026-11-06" vira "06/11/2026" (dica do gráfico). */
export function formatDayKeyLong(key: string): string {
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2025-11" vira "nov/25" (eixo de 12 meses estreito, onde "nov. de 25" não cabe). */
export function formatMonthShort(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${MONTHS[Number(month) - 1]}/${year.slice(2)}`;
}

const axisFormatters = new Map<number, Intl.NumberFormat>();

/** Rótulo do eixo de preço: em reais inteiros, ou com os centavos quando o passo é menor que R$ 1. */
export function formatAxisBRL(value: number, step: number): string {
  const digits = step < 1 ? 2 : 0;
  let formatter = axisFormatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    axisFormatters.set(digits, formatter);
  }
  return formatter.format(value);
}
