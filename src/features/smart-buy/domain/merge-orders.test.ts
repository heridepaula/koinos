import { describe, expect, it } from "vitest";
import { mergeOrders } from "./merge-orders";
import type { StockBuyOrder } from "./stock-buy";
import type { CascadeOrder } from "./fii-cascade";

function fiiOrder(ticker: string, total: number): CascadeOrder {
  return {
    ticker,
    rank: 1,
    quantity: 1,
    fromLeftover: 0,
    price: total,
    total,
    weightBefore: 0,
    weightAfter: 0,
    targetWeight: 0,
    marginToCeiling: 0,
    priceToBook: null,
    vacancy: null,
    dividendRatio: null,
    tensors: { valuation: 1, dividends: 1, safety: 1, vacancy: 1 },
    macro: "Tijolo",
    sector: null,
    fillBefore: 0,
    gapBefore: 0,
    need: 0,
    limitedBy: null,
    gapAfter: 0,
  };
}

function stockOrder(ticker: string, total: number): StockBuyOrder {
  return {
    ticker,
    rank: 1,
    quantity: 1,
    fromLeftover: 0,
    lot: 1,
    price: total,
    total,
    marginOfSafety: 0,
    deficitBefore: 0,
    targetValue: 0,
    targetWeight: 0,
    weightBefore: 0,
    weightAfter: 0,
  };
}

const rows = (merged: ReturnType<typeof mergeOrders>) =>
  merged.map((item) => [item.kind, item.order.ticker, item.order.total]);

describe("mergeOrders", () => {
  it("junta as duas carteiras, da maior para a menor ordem, com a classe de cada linha", () => {
    const merged = mergeOrders(
      [fiiOrder("HGLG11", 300), fiiOrder("KNRI11", 100)],
      [stockOrder("BBAS3", 200), stockOrder("VALE3", 50)],
    );
    expect(rows(merged)).toEqual([
      ["FII", "HGLG11", 300],
      ["ACAO", "BBAS3", 200],
      ["FII", "KNRI11", 100],
      ["ACAO", "VALE3", 50],
    ]);
  });

  it("no empate do total, vai pelo ticker", () => {
    const merged = mergeOrders(
      [fiiOrder("XPML11", 100), fiiOrder("HGLG11", 100)],
      [stockOrder("BBAS3", 100)],
    );
    expect(rows(merged)).toEqual([
      ["ACAO", "BBAS3", 100],
      ["FII", "HGLG11", 100],
      ["FII", "XPML11", 100],
    ]);
  });

  it("cada linha leva a ordem original, e uma carteira sem ordens não atrapalha", () => {
    const fii = [fiiOrder("HGLG11", 300)];
    const stock = [stockOrder("BBAS3", 200)];
    const merged = mergeOrders(fii, stock);
    expect(merged[0].order).toBe(fii[0]);
    expect(merged[1].order).toBe(stock[0]);
    expect(rows(mergeOrders([], stock))).toEqual([["ACAO", "BBAS3", 200]]);
    expect(rows(mergeOrders(fii, []))).toEqual([["FII", "HGLG11", 300]]);
    expect(mergeOrders([], [])).toEqual([]);
  });
});
