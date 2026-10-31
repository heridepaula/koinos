import type { StockBuyOrder } from "./stock-buy";
import type { CascadeOrder } from "./suno-cascade";

/** Uma ordem de qualquer carteira, para a tabela única das Recomendações. */
export type MergedOrder =
  { kind: "FII"; order: CascadeOrder } | { kind: "ACAO"; order: StockBuyOrder };

/** As ordens das duas carteiras juntas, da maior para a menor (empate: ticker). */
export function mergeOrders(
  fii: readonly CascadeOrder[],
  stock: readonly StockBuyOrder[],
): MergedOrder[] {
  return [
    ...fii.map((order) => ({ kind: "FII" as const, order })),
    ...stock.map((order) => ({ kind: "ACAO" as const, order })),
  ].sort((a, b) => b.order.total - a.order.total || a.order.ticker.localeCompare(b.order.ticker));
}
