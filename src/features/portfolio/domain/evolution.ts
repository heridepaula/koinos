import { replayLedger, type LedgerEntry } from "@/features/transactions";
import { round2 } from "@/shared/lib/money";
import { monthKeyOfTradeDate, monthRange } from "@/shared/lib/time";
import type { EvolutionPoint } from "./types";

/**
 * Patrimônio e valor investido no fim de cada mês, do primeiro lançamento até o mês atual.
 * Preço do mês: fechamento mensal; no mês atual, a cotação atual. Sem preço, usa o último
 * fechamento conhecido e, sem nenhum, o preço médio (o ponto fica marcado como estimado).
 */
export function computeEvolution(
  entries: readonly LedgerEntry[],
  closes: ReadonlyMap<string, ReadonlyMap<string, number>>,
  currentPrices: ReadonlyMap<string, number | null>,
  nowMonth: string,
): EvolutionPoint[] {
  if (entries.length === 0) return [];
  const firstMonth = entries
    .map((entry) => monthKeyOfTradeDate(entry.date))
    .reduce((min, month) => (month < min ? month : min));
  const months = monthRange(firstMonth, nowMonth);
  const lastKnown = new Map<string, number>();

  return months.map((month) => {
    for (const [ticker, byMonth] of closes) {
      const close = byMonth.get(month);
      if (close !== undefined) lastKnown.set(ticker, close);
    }
    const { positions } = replayLedger(
      entries.filter((entry) => monthKeyOfTradeDate(entry.date) <= month),
    );
    let patrimony = 0;
    let invested = 0;
    let estimated = false;
    for (const position of positions) {
      if (position.quantity <= 0) continue;
      invested += position.totalCost;
      let price =
        month === nowMonth
          ? (currentPrices.get(position.ticker) ?? lastKnown.get(position.ticker) ?? null)
          : (lastKnown.get(position.ticker) ?? null);
      if (price === null) {
        price = position.averagePrice;
        estimated = true;
      }
      patrimony += position.quantity * price;
    }
    return { month, patrimony: round2(patrimony), invested: round2(invested), estimated };
  });
}
