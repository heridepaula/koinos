import type { LedgerEntry } from "@/features/transactions";
import { addMonths, monthKeyOfTradeDate } from "@/shared/lib/time";

// O aporte médio do bolso (spec 2026-11-07-independencia-financeira-v2 §2.5). Os proventos ficam de
// fora: o prazo os reinveste por inteiro, pelo DY.

/** Meses fechados usados na média: a média anual do bolso (pedido do dono, 2026-11-07). */
export const APORTE_MONTHS = 12;

/** Os `count` meses fechados antes do atual, do mais antigo ao mais novo. */
export function closedMonths(currentMonth: string, count: number = APORTE_MONTHS): string[] {
  return Array.from({ length: count }, (_, index) => addMonths(currentMonth, index - count));
}

/** Venda em dinheiro: negócio (ou sem kind) e leilão de fração. A saída de incorporação não conta. */
const isCashSale = (entry: LedgerEntry) =>
  entry.type === "SELL" && (!entry.kind || entry.kind === "NEGOCIO" || entry.kind === "FRACAO");

/** O que as vendas em dinheiro do mês renderam: quantidade × preço menos as taxas. */
export function cashSales(entries: readonly LedgerEntry[], month: string): number {
  let total = 0;
  for (const entry of entries) {
    if (isCashSale(entry) && monthKeyOfTradeDate(entry.date) === month) {
      total += entry.quantity * entry.unitPrice - entry.fees;
    }
  }
  return total;
}

/** A média do bolso menos as vendas de cada mês; um mês negativo abate os outros; piso 0. */
export function averageMonthlyAporte(
  months: readonly { fromPocket: number; sales: number }[],
): number {
  if (months.length === 0) return 0;
  const total = months.reduce((sum, month) => sum + month.fromPocket - month.sales, 0);
  return Math.max(0, total / months.length);
}
