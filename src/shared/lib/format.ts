// Formatação em pt-BR. Datas de negócio ficam à meia-noite UTC, por isso usam timeZone UTC.

// signDisplay "negative": o que arredonda para zero (sobra de ponto flutuante, como -1e-13) sai
// "R$ 0,00", sem o sinal; os demais valores, positivos ou negativos, saem como antes.
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  signDisplay: "negative",
});
const compactBrl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const compactNumber = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const quantity = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const percentFormatters = new Map<number, Intl.NumberFormat>();
const tradeDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});
const monthLabel = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  month: "short",
  year: "2-digit",
});

export function formatBRL(value: number): string {
  return brl.format(value);
}

export function formatCompactBRL(value: number): string {
  return compactBrl.format(value);
}

/** "7,6 mil", sem o R$: para células apertadas em que a moeda já está dita (o calendário do celular). */
export function formatCompactNumber(value: number): string {
  return compactNumber.format(value);
}

export function formatQuantity(value: number): string {
  return quantity.format(value);
}

export function formatPercent(fraction: number, digits = 2): string {
  let formatter = percentFormatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("pt-BR", {
      style: "percent",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    percentFormatters.set(digits, formatter);
  }
  return formatter.format(fraction);
}

export function formatSignedPercent(fraction: number, digits = 2): string {
  const text = formatPercent(fraction, digits);
  return fraction > 0 ? `+${text}` : text;
}

export function formatTradeDate(date: Date): string {
  return tradeDate.format(date);
}

export function formatDateTime(date: Date): string {
  return dateTime.format(date);
}

/** "2026-09" vira "set. de 26". */
export function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return monthLabel.format(new Date(Date.UTC(year, month - 1, 1)));
}
