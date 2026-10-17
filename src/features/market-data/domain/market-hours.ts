import { saoPauloParts, saoPauloToUtc } from "@/shared/lib/time";

// Pregão da B3: 10:00 às 18:00 (São Paulo), segunda a sexta. O plano gratuito da brapi
// tem ~30 min de atraso, então a janela considera até 18:30. Feriados não são tratados.
const SESSION_OPEN_MINUTES = 10 * 60;
const SESSION_CLOSE_WITH_DELAY_MINUTES = 18 * 60 + 30;

/** Durante o pregão, uma cotação vence depois de 30 minutos. */
export const QUOTE_MAX_AGE_MS = 30 * 60 * 1000;

const isWeekday = (weekday: number) => weekday >= 1 && weekday <= 5;

export function isTradingWindow(now: Date): boolean {
  const parts = saoPauloParts(now);
  const minutes = parts.hour * 60 + parts.minute;
  return (
    isWeekday(parts.weekday) &&
    minutes >= SESSION_OPEN_MINUTES &&
    minutes < SESSION_CLOSE_WITH_DELAY_MINUTES
  );
}

/** Último fechamento (18:30 em São Paulo, em dia útil) até `now`. */
export function lastCloseAtOrBefore(now: Date): Date {
  const today = saoPauloParts(now);
  for (let daysBack = 0; daysBack <= 7; daysBack++) {
    // Meio-dia UTC do dia de calendário: o dia da semana em UTC é o mesmo de São Paulo.
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day - daysBack, 12));
    if (!isWeekday(day.getUTCDay())) continue;
    const close = saoPauloToUtc(
      day.getUTCFullYear(),
      day.getUTCMonth() + 1,
      day.getUTCDate(),
      18,
      30,
    );
    if (close.getTime() <= now.getTime()) return close;
  }
  return new Date(now.getTime() - 7 * 86_400_000);
}

/**
 * Cotação vencida:
 * - nunca buscada; ou
 * - no pregão, buscada há mais de 30 min; ou
 * - fora do pregão, buscada antes do último fechamento.
 * Fora do pregão e no fim de semana, não gasta cota.
 */
export function isQuoteStale(fetchedAt: Date | null | undefined, now: Date): boolean {
  if (!fetchedAt) return true;
  if (isTradingWindow(now)) return now.getTime() - fetchedAt.getTime() > QUOTE_MAX_AGE_MS;
  return fetchedAt.getTime() < lastCloseAtOrBefore(now).getTime();
}
