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

// O pregão de verdade, sem o atraso da brapi: é o que o "Mercado aberto" diz ao dono.
const SESSION_CLOSE_MINUTES = 18 * 60;

/** O pregão está acontecendo agora: 10:00 às 18:00 em São Paulo, de segunda a sexta. */
export function isMarketOpen(now: Date): boolean {
  const parts = saoPauloParts(now);
  const minutes = parts.hour * 60 + parts.minute;
  return (
    isWeekday(parts.weekday) && minutes >= SESSION_OPEN_MINUTES && minutes < SESSION_CLOSE_MINUTES
  );
}

/**
 * O pregão (data de negócio, meia-noite UTC) a que uma cotação buscada em `fetchedAt` se refere: o
 * dia dela, se for dia útil depois da abertura; senão, o dia útil anterior. Uma cotação de sábado,
 * ou de segunda às 9h, traz a variação de sexta.
 */
export function quoteSessionDate(fetchedAt: Date): Date {
  const parts = saoPauloParts(fetchedAt);
  const afterOpen = parts.hour * 60 + parts.minute >= SESSION_OPEN_MINUTES;
  for (let daysBack = 0; daysBack <= 7; daysBack++) {
    const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - daysBack));
    if (!isWeekday(day.getUTCDay())) continue;
    if (daysBack === 0 && !afterOpen) continue;
    return day;
  }
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

/** O mercado agora e o pregão da variação do dia que a tela mostra. */
export type MarketSession = {
  /** O pregão está aberto agora (feriados não são tratados). */
  open: boolean;
  /** O pregão da variação do dia (data de negócio), ou null sem cotação. */
  sessionDate: Date | null;
  /** A variação é do pregão de hoje. */
  today: boolean;
};

export function marketSession(now: Date, quoteFetchedAt: Date | null | undefined): MarketSession {
  const sessionDate = quoteFetchedAt ? quoteSessionDate(quoteFetchedAt) : null;
  const { year, month, day } = saoPauloParts(now);
  return {
    open: isMarketOpen(now),
    sessionDate,
    today: sessionDate !== null && sessionDate.getTime() === Date.UTC(year, month - 1, day),
  };
}

const WEEKDAY_SHORT = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

/**
 * O sufixo da variação do dia: "hoje" quando ela é do pregão de hoje; senão, o dia dela ("na
 * sex., 06/11"), para um sábado não parecer dia de pregão.
 */
export function dayChangeLabel(session: MarketSession): string {
  if (session.today || session.sessionDate === null) return "hoje";
  const date = session.sessionDate;
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `na ${WEEKDAY_SHORT[date.getUTCDay()]}, ${dd}/${mm}`;
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
