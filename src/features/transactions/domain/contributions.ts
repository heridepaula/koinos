import { round2 } from "@/shared/lib/money";
import { monthKeyOfTradeDate } from "@/shared/lib/time";
import type { LedgerEntry } from "./types";

export type MonthlyContribution = { month: string; amount: number };

/**
 * Valor comprado (aportado) em cada mês pedido, incluindo meses sem compra (zero).
 * A compra do destino numa incorporação só transfere custo: não é aporte.
 */
export function monthlyContributions(
  entries: readonly LedgerEntry[],
  months: readonly string[],
): MonthlyContribution[] {
  const totals = new Map(months.map((month) => [month, 0]));
  for (const entry of entries) {
    if (entry.type !== "BUY" || entry.kind === "INCORPORACAO") continue;
    const month = monthKeyOfTradeDate(entry.date);
    const current = totals.get(month);
    if (current !== undefined) {
      totals.set(month, current + entry.quantity * entry.unitPrice + entry.fees);
    }
  }
  return months.map((month) => ({ month, amount: round2(totals.get(month) ?? 0) }));
}
