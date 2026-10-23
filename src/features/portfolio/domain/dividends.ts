import { sortLedger, type DividendEntry, type LedgerEntry } from "@/features/transactions";
import {
  addMonths,
  currentMonthKey,
  monthKeyOfTradeDate,
  parseTradeDate,
  todayTradeDate,
} from "@/shared/lib/time";
import type {
  AdjustedResult,
  DividendMonthGroup,
  DividendMonthSummary,
  DividendTickerGroup,
  DividendYearGroup,
  UpcomingDividend,
} from "./types";

// Regras: docs/superpowers/specs/2026-10-18-proventos-design.md (§4).

const DAY = 86_400_000;
const EPSILON = 1e-9;
/** FIIs costumam pagar de 5 a 15 dias depois da data com. */
const PAY_WINDOW_DAYS = 15;

/** Cotas de `ticker` no fim do dia anterior a `exDate`. */
export function quantityBefore(
  entries: readonly LedgerEntry[],
  ticker: string,
  exDate: Date,
): number {
  let quantity = 0;
  for (const entry of sortLedger(entries.filter((item) => item.ticker === ticker))) {
    if (entry.date.getTime() >= exDate.getTime()) break;
    quantity += entry.type === "BUY" ? entry.quantity : -entry.quantity;
    if (quantity < EPSILON) quantity = 0;
  }
  return quantity;
}

/**
 * Proventos anunciados e ainda não recebidos: data ex no mês atual ou no anterior, até hoje,
 * sem provento da B3 do mesmo FII pago na data ex ou depois. Do mês anterior, só o que tinha
 * pagamento previsto para este mês: o que vencia no mês passado é daquele mês, não deste.
 */
export function upcomingDividends(input: {
  now: Date;
  transactions: readonly LedgerEntry[];
  received: readonly DividendEntry[];
  announcements: ReadonlyMap<string, readonly { exDate: Date; perShare: number }[]>;
}): UpcomingDividend[] {
  const month = currentMonthKey(input.now);
  const firstMonth = addMonths(month, -1);
  // Datas ex são datas de negócio (meia-noite UTC): compara com o dia de hoje em São Paulo.
  const today = todayTradeDate(input.now);
  const monthStart = parseTradeDate(`${month}-01`);
  const result: UpcomingDividend[] = [];
  for (const [ticker, list] of input.announcements) {
    for (const announcement of list) {
      const exMonth = monthKeyOfTradeDate(announcement.exDate);
      if (exMonth < firstMonth || exMonth > month) continue;
      if (announcement.exDate.getTime() > today.getTime()) continue;
      const payBy = new Date(announcement.exDate.getTime() + PAY_WINDOW_DAYS * DAY);
      if (exMonth < month && payBy.getTime() < monthStart.getTime()) continue;
      const paid = input.received.some(
        (item) => item.ticker === ticker && item.paidAt.getTime() >= announcement.exDate.getTime(),
      );
      if (paid) continue;
      const quantity = quantityBefore(input.transactions, ticker, announcement.exDate);
      if (quantity <= 0) continue;
      result.push({
        ticker,
        exDate: announcement.exDate,
        quantity,
        perShare: announcement.perShare,
        amount: quantity * announcement.perShare,
        payBy,
      });
    }
  }
  return result.sort(
    (a, b) => a.exDate.getTime() - b.exDate.getTime() || a.ticker.localeCompare(b.ticker),
  );
}

export function monthSummary(
  now: Date,
  received: readonly DividendEntry[],
  upcoming: readonly UpcomingDividend[],
): DividendMonthSummary {
  const month = currentMonthKey(now);
  const receivedTotal = received
    .filter((item) => monthKeyOfTradeDate(item.paidAt) === month)
    .reduce((sum, item) => sum + item.amount, 0);
  const upcomingTotal = upcoming.reduce((sum, item) => sum + item.amount, 0);
  return {
    month,
    received: receivedTotal,
    upcoming: upcomingTotal,
    total: receivedTotal + upcomingTotal,
  };
}

/** Por mês, do mais recente para o mais antigo, com o detalhe por FII (maior primeiro). */
export function groupByMonth(received: readonly DividendEntry[]): DividendMonthGroup[] {
  const months = new Map<string, Map<string, number>>();
  for (const item of received) {
    const key = monthKeyOfTradeDate(item.paidAt);
    const tickers = months.get(key) ?? new Map<string, number>();
    tickers.set(item.ticker, (tickers.get(item.ticker) ?? 0) + item.amount);
    months.set(key, tickers);
  }
  return [...months]
    .map(([month, tickers]) => ({
      month,
      total: [...tickers.values()].reduce((sum, value) => sum + value, 0),
      byTicker: [...tickers]
        .map(([ticker, amount]) => ({ ticker, amount }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** Por ano: total e média mensal sobre os meses com algum provento. */
export function groupByYear(received: readonly DividendEntry[]): DividendYearGroup[] {
  const years = new Map<string, { total: number; months: Set<string> }>();
  for (const item of received) {
    const month = monthKeyOfTradeDate(item.paidAt);
    const year = month.slice(0, 4);
    const group = years.get(year) ?? { total: 0, months: new Set<string>() };
    group.total += item.amount;
    group.months.add(month);
    years.set(year, group);
  }
  return [...years]
    .map(([year, group]) => ({
      year,
      total: group.total,
      months: group.months.size,
      monthlyAverage: group.total / group.months.size,
    }))
    .sort((a, b) => b.year.localeCompare(a.year));
}

/** Por papel: total acumulado, número de pagamentos e o último (maior total primeiro). */
export function groupByTicker(received: readonly DividendEntry[]): DividendTickerGroup[] {
  const tickers = new Map<string, DividendTickerGroup>();
  for (const item of received) {
    const group = tickers.get(item.ticker) ?? {
      ticker: item.ticker,
      total: 0,
      payments: 0,
      lastPaidAt: item.paidAt,
    };
    group.total += item.amount;
    group.payments += 1;
    if (item.paidAt > group.lastPaidAt) group.lastPaidAt = item.paidAt;
    tickers.set(item.ticker, group);
  }
  return [...tickers.values()].sort((a, b) => b.total - a.total);
}

/** Total recebido por FII, desde sempre. */
export function dividendsByTicker(received: readonly DividendEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of received)
    totals.set(item.ticker, (totals.get(item.ticker) ?? 0) + item.amount);
  return totals;
}

/** Com proventos = cotação + proventos; total = cotação + proventos + vendas. */
export function adjustedResult(
  unrealized: number,
  dividends: number,
  realized: number,
): AdjustedResult {
  return { withDividends: unrealized + dividends, total: unrealized + dividends + realized };
}
