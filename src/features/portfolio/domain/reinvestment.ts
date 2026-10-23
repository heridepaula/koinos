import type { DividendEntry, LedgerEntry } from "@/features/transactions";
import { monthKeyOfTradeDate } from "@/shared/lib/time";
import type { MonthPurchase, ReinvestmentMonth, ReinvestmentSplit } from "./types";

// Regras: docs/superpowers/specs/2026-10-23-reinvestimento-design.md (§3).

/** Mês sem % salva: no método Suno, todo provento volta para a carteira. */
export const DEFAULT_REINVESTMENT_PERCENT = 100;

/** Compras pagas em dinheiro. Lançamento antigo, sem `kind`, vale como negócio. */
const isCashPurchase = (entry: LedgerEntry) =>
  entry.type === "BUY" &&
  (entry.kind === undefined || entry.kind === "NEGOCIO" || entry.kind === "SUBSCRICAO");

/** Compras em dinheiro do mês (AAAA-MM), da mais recente para a mais antiga. */
export function monthPurchases(entries: readonly LedgerEntry[], month: string): MonthPurchase[] {
  return entries
    .filter((entry) => isCashPurchase(entry) && monthKeyOfTradeDate(entry.date) === month)
    .map((entry) => ({
      date: entry.date,
      ticker: entry.ticker,
      kind: entry.kind === "SUBSCRICAO" ? ("SUBSCRICAO" as const) : ("NEGOCIO" as const),
      quantity: entry.quantity,
      unitPrice: entry.unitPrice,
      fees: entry.fees,
      total: entry.quantity * entry.unitPrice + entry.fees,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime() || a.ticker.localeCompare(b.ticker));
}

/** §3.2: o reinvestido pretendido é a % dos proventos, limitado ao que foi comprado. */
export function splitAporte(aporte: number, dividends: number, percent: number): ReinvestmentSplit {
  const intended = (dividends * percent) / 100;
  const fromDividends = Math.min(intended, aporte);
  return {
    fromDividends,
    fromPocket: aporte - fromDividends,
    unspent: intended - fromDividends,
    dividendsShare: aporte > 0 ? fromDividends / aporte : null,
  };
}

/** §3.3: um item por mês pedido, com a % salva ou a padrão. */
export function reinvestmentHistory(input: {
  transactions: readonly LedgerEntry[];
  received: readonly DividendEntry[];
  percents: ReadonlyMap<string, number>;
  months: readonly string[];
}): ReinvestmentMonth[] {
  const aportes = new Map<string, { total: number; count: number }>();
  for (const entry of input.transactions) {
    if (!isCashPurchase(entry)) continue;
    const month = monthKeyOfTradeDate(entry.date);
    const current = aportes.get(month) ?? { total: 0, count: 0 };
    current.total += entry.quantity * entry.unitPrice + entry.fees;
    current.count += 1;
    aportes.set(month, current);
  }
  const dividends = new Map<string, number>();
  for (const item of input.received) {
    const month = monthKeyOfTradeDate(item.paidAt);
    dividends.set(month, (dividends.get(month) ?? 0) + item.amount);
  }
  return input.months.map((month) => {
    const saved = input.percents.get(month);
    const percent = saved ?? DEFAULT_REINVESTMENT_PERCENT;
    const aporte = aportes.get(month)?.total ?? 0;
    const received = dividends.get(month) ?? 0;
    return {
      month,
      aporte,
      purchaseCount: aportes.get(month)?.count ?? 0,
      dividends: received,
      percent,
      isDefault: saved === undefined,
      ...splitAporte(aporte, received, percent),
    };
  });
}

/** Soma do período: aporte, dinheiro de proventos e a participação dos proventos. */
export function summarizeReinvestment(history: readonly ReinvestmentMonth[]) {
  const aporte = history.reduce((sum, month) => sum + month.aporte, 0);
  const fromDividends = history.reduce((sum, month) => sum + month.fromDividends, 0);
  return { aporte, fromDividends, share: aporte > 0 ? fromDividends / aporte : null };
}

/** Meses do seletor: os com compra em dinheiro ou provento, mais o atual; do mais recente ao mais antigo. */
export function reinvestmentMonths(
  transactions: readonly LedgerEntry[],
  received: readonly DividendEntry[],
  currentMonth: string,
): string[] {
  const months = new Set<string>([currentMonth]);
  for (const entry of transactions)
    if (isCashPurchase(entry)) months.add(monthKeyOfTradeDate(entry.date));
  for (const item of received) months.add(monthKeyOfTradeDate(item.paidAt));
  return [...months]
    .filter((month) => month <= currentMonth)
    .sort()
    .reverse();
}
