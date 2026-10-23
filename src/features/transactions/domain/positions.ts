import type { LedgerEntry, Oversell, Position, RealizedSale } from "./types";

const EPSILON = 1e-9;

/** Ordem de processamento: data; no mesmo dia, compras antes de vendas; depois, criação. */
export function sortLedger<T extends Pick<LedgerEntry, "date" | "type" | "createdAt">>(
  entries: readonly T[],
): T[] {
  return [...entries].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      (a.type === b.type ? 0 : a.type === "BUY" ? -1 : 1) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

type TickerState = {
  quantity: number;
  cost: number;
  realized: number;
  firstDate: Date;
  lastDate: Date;
};

/**
 * Reprocessa o histórico pelo método da Receita:
 * - compra soma quantidade e custo (com taxas);
 * - venda baixa a posição pelo preço médio vigente, sem alterá-lo, e gera lucro realizado;
 * - posição zerada zera o custo.
 * Vendas maiores que a posição viram `oversells`; o cálculo segue com o que existia.
 * `sales` traz cada venda na ordem do processamento, com as pernas de saída das incorporações.
 */
export function replayLedger(entries: readonly LedgerEntry[]): {
  positions: Position[];
  oversells: Oversell[];
  sales: RealizedSale[];
} {
  const states = new Map<string, TickerState>();
  const oversells: Oversell[] = [];
  const sales: RealizedSale[] = [];

  for (const entry of sortLedger(entries)) {
    let state = states.get(entry.ticker);
    if (!state) {
      state = { quantity: 0, cost: 0, realized: 0, firstDate: entry.date, lastDate: entry.date };
      states.set(entry.ticker, state);
    }
    state.lastDate = entry.date;

    if (entry.type === "BUY") {
      state.quantity += entry.quantity;
      state.cost += entry.quantity * entry.unitPrice + entry.fees;
      continue;
    }

    let sellQuantity = entry.quantity;
    if (sellQuantity > state.quantity + EPSILON) {
      oversells.push({
        entryId: entry.id,
        ticker: entry.ticker,
        date: entry.date,
        sellQuantity: entry.quantity,
        heldQuantity: state.quantity,
      });
      sellQuantity = state.quantity;
    }
    if (sellQuantity <= EPSILON) continue;

    const averagePrice = state.cost / state.quantity;
    const fees = entry.fees * (sellQuantity / entry.quantity);
    const proceeds = sellQuantity * entry.unitPrice - fees;
    const cost = sellQuantity * averagePrice;
    sales.push({
      entryId: entry.id,
      ticker: entry.ticker,
      date: entry.date,
      kind: entry.kind ?? "NEGOCIO",
      quantity: sellQuantity,
      proceeds,
      cost,
    });
    state.realized += proceeds - cost;
    state.cost -= cost;
    state.quantity -= sellQuantity;
    if (Math.abs(state.quantity) < EPSILON) {
      state.quantity = 0;
      state.cost = 0;
    }
  }

  const positions = [...states.entries()]
    .map(([ticker, state]) => ({
      ticker,
      quantity: state.quantity,
      totalCost: state.cost,
      averagePrice: state.quantity > 0 ? state.cost / state.quantity : 0,
      realizedPnL: state.realized,
      firstDate: state.firstDate,
      lastDate: state.lastDate,
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));

  return { positions, oversells, sales };
}

export function computePositions(entries: readonly LedgerEntry[]): Position[] {
  return replayLedger(entries).positions;
}

export function findOversells(entries: readonly LedgerEntry[]): Oversell[] {
  return replayLedger(entries).oversells;
}
