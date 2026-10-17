// Datas de negócio (data de um lançamento) ficam à meia-noite UTC do dia do negócio.
// Regras de pregão e "mês atual" usam o fuso de São Paulo.

export const SAO_PAULO_TZ = "America/Sao_Paulo";

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = domingo ... 6 = sábado */
  weekday: number;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SAO_PAULO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

export function saoPauloParts(date: Date): ZonedParts {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

/** Converte uma data/hora local de São Paulo no instante UTC correspondente. */
export function saoPauloToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const local = saoPauloParts(new Date(guess));
  const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  return new Date(guess - (localAsUtc - guess));
}

export function monthKeyOfTradeDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey(now: Date): string {
  const parts = saoPauloParts(now);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

export function addMonths(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  return monthKeyOfTradeDate(new Date(Date.UTC(year, month - 1 + delta, 1)));
}

/** Meses de `from` a `to`, inclusive, no formato YYYY-MM. */
export function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  for (let key = from; key <= to; key = addMonths(key, 1)) months.push(key);
  return months;
}

/** "2026-10-17" vira a data de negócio correspondente. */
export function parseTradeDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Hoje, em São Paulo, como data de negócio. */
export function todayTradeDate(now: Date): Date {
  const parts = saoPauloParts(now);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}
