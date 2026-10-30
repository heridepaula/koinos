import { DAY, EPSILON, sameQty } from "./codes";
import type { B3Trade, MovementRow } from "./types";

// Aluguel de ações e cotas (spec ações etapa 1, §5.5). Puro: o plano decide o que fazer com as
// ações que voltam a mais, e a conferência pelos proventos usa as janelas do aluguel.

const SETTLEMENT_KIND = "Transferência - Liquidação";
/** Um negócio liquida de D+0 a D+7 corridos (D+2, mais fins de semana e feriados). */
const SETTLEMENT_MAX_DAYS = 7;

/** Um contrato de aluguel: a saída das ações e a volta, se já houve. */
export type LendingLeg = {
  ticker: string;
  out: Date;
  outQuantity: number;
  /** Null enquanto as ações estão alugadas. */
  back: Date | null;
  backQuantity: number | null;
};

/**
 * Saídas e voltas de aluguel, pelas linhas de "Transferência - Liquidação" que não liquidam
 * um negócio:
 * 1. Liquidação de negócio: os negócios do ativo no mesmo pregão e sentido, somados (fracionário
 *    incluso), de 0 a 7 dias depois; sem uma linha para a soma, cada negócio sozinho.
 * 2. O resto é aluguel: débito é saída, crédito é volta.
 * 3. Cada volta fecha a saída aberta mais antiga de mesma quantidade ou, sem ela, a maior saída
 *    aberta menor que a volta. No mesmo dia, as voltas vêm antes das saídas. Volta sem saída
 *    aberta é ignorada: é uma liquidação que o passo 1 não reconheceu.
 */
export function lendingLegs(
  rows: readonly MovementRow[],
  trades: readonly B3Trade[],
): LendingLeg[] {
  const settlements = rows
    .filter((row) => row.kind === SETTLEMENT_KIND && (row.quantity ?? 0) > EPSILON)
    .map((row) => ({
      code: row.code,
      credit: row.credit,
      date: row.date,
      quantity: row.quantity ?? 0,
      used: false,
    }));

  // 1. Negócios do pregão, somados por ativo, dia e sentido.
  const groups = new Map<
    string,
    { ticker: string; date: Date; buy: boolean; total: number; parts: number[] }
  >();
  for (const trade of trades) {
    const key = `${trade.ticker}|${trade.date.getTime()}|${trade.type}`;
    const group = groups.get(key) ?? {
      ticker: trade.ticker,
      date: trade.date,
      buy: trade.type === "BUY",
      total: 0,
      parts: [],
    };
    group.total += trade.quantity;
    group.parts.push(trade.quantity);
    groups.set(key, group);
  }
  const settle = (ticker: string, date: Date, buy: boolean, quantity: number) => {
    const match = settlements.find((row) => {
      const days = (row.date.getTime() - date.getTime()) / DAY;
      return (
        !row.used &&
        row.code === ticker &&
        row.credit === buy &&
        sameQty(row.quantity, quantity) &&
        days >= 0 &&
        days <= SETTLEMENT_MAX_DAYS
      );
    });
    if (match) match.used = true;
    return Boolean(match);
  };
  for (const group of [...groups.values()].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    if (settle(group.ticker, group.date, group.buy, group.total)) continue;
    for (const part of group.parts) settle(group.ticker, group.date, group.buy, part);
  }

  // 2 e 3. O resto é aluguel.
  const loans = settlements
    .filter((row) => !row.used)
    .sort((a, b) => a.date.getTime() - b.date.getTime() || Number(b.credit) - Number(a.credit));
  const open = new Map<string, { date: Date; quantity: number }[]>();
  const legs: LendingLeg[] = [];
  for (const row of loans) {
    const list = open.get(row.code) ?? [];
    open.set(row.code, list);
    if (!row.credit) {
      list.push({ date: row.date, quantity: row.quantity });
      continue;
    }
    let index = list.findIndex((item) => sameQty(item.quantity, row.quantity));
    if (index < 0) {
      const smaller = list.filter((item) => item.quantity < row.quantity - EPSILON);
      if (smaller.length > 0) {
        const largest = Math.max(...smaller.map((item) => item.quantity));
        index = list.findIndex((item) => item.quantity === largest);
      }
    }
    if (index < 0) continue;
    const [out] = list.splice(index, 1);
    legs.push({
      ticker: row.code,
      out: out!.date,
      outQuantity: out!.quantity,
      back: row.date,
      backQuantity: row.quantity,
    });
  }
  for (const [ticker, list] of open) {
    for (const item of list) {
      legs.push({
        ticker,
        out: item.date,
        outQuantity: item.quantity,
        back: null,
        backQuantity: null,
      });
    }
  }
  return legs.sort((a, b) => a.out.getTime() - b.out.getTime() || a.ticker.localeCompare(b.ticker));
}
