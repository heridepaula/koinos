import { describe, expect, it } from "vitest";
import type { AssetClass } from "@/features/market-data";
import { byClass } from "@/shared/lib/class-filter";
import { closedPositions, type ClosedLedgerEntry } from "./closed-positions";

let seq = 0;
function entry(
  ticker: string,
  type: "BUY" | "SELL",
  quantity: number,
  unitPrice: number,
  iso: string,
  kind: ClosedLedgerEntry["kind"] = "NEGOCIO",
): ClosedLedgerEntry {
  seq++;
  return {
    id: `e${seq}`,
    ticker,
    type,
    quantity,
    unitPrice,
    fees: 0,
    date: new Date(`${iso}T00:00:00Z`),
    createdAt: new Date(seq),
    kind,
  };
}

const classes = new Map<string, AssetClass | null>([
  ["AAAA11", "FII"],
  ["PETR4", "ACAO"],
  ["VALE3", "ACAO"],
]);
const rowOf = (entries: ClosedLedgerEntry[], ticker: string) =>
  closedPositions(entries, classes).find((row) => row.ticker === ticker);

describe("closedPositions: IR dos FIIs", () => {
  it("continua 20% do lucro, sem isenção", () => {
    const row = rowOf(
      [
        entry("AAAA11", "BUY", 100, 10, "2026-01-05"),
        entry("AAAA11", "SELL", 100, 12, "2026-02-10"),
      ],
      "AAAA11",
    );
    expect(row).toMatchObject({
      assetClass: "FII",
      realizedPnL: 200,
      estimatedTax: 40,
      taxExempt: false,
    });
  });
});

describe("closedPositions: IR das ações", () => {
  it("mês com R$ 20.000,00 vendidos é isento", () => {
    const row = rowOf(
      [
        entry("PETR4", "BUY", 1000, 15, "2026-01-05"),
        entry("PETR4", "SELL", 1000, 20, "2026-02-10"),
      ],
      "PETR4",
    );
    expect(row).toMatchObject({
      assetClass: "ACAO",
      realizedPnL: 5000,
      estimatedTax: 0,
      taxExempt: true,
    });
  });

  it("acima de R$ 20.000,00 no mês, somando as ações, paga 15% do lucro", () => {
    const rows = closedPositions(
      [
        entry("PETR4", "BUY", 1000, 15, "2026-01-05"),
        entry("PETR4", "SELL", 1000, 19, "2026-02-10"),
        entry("VALE3", "BUY", 1, 900, "2026-01-05"),
        entry("VALE3", "SELL", 1, 1000.01, "2026-02-11"),
      ],
      classes,
    );
    expect(rows.find((row) => row.ticker === "PETR4")).toMatchObject({
      estimatedTax: 600,
      taxExempt: false,
    });
    expect(rows.find((row) => row.ticker === "VALE3")).toMatchObject({
      estimatedTax: 15,
      taxExempt: false,
    });
  });

  it("a venda de uma posição ainda aberta conta para o limite do mês", () => {
    const row = rowOf(
      [
        entry("VALE3", "BUY", 200, 50, "2026-01-05"),
        entry("VALE3", "SELL", 100, 60, "2026-03-10"),
        entry("PETR4", "BUY", 1000, 10, "2026-01-05"),
        entry("PETR4", "SELL", 1000, 15, "2026-03-12"),
      ],
      "PETR4",
    );
    expect(row).toMatchObject({ realizedPnL: 5000, estimatedTax: 750, taxExempt: false });
  });

  it("o prejuízo de um mês não compensa o lucro de outro", () => {
    const row = rowOf(
      [
        entry("PETR4", "BUY", 2000, 10, "2026-01-05"),
        entry("PETR4", "SELL", 1000, 25, "2026-02-10"),
        entry("PETR4", "SELL", 1000, 5, "2026-03-10"),
      ],
      "PETR4",
    );
    expect(row).toMatchObject({ realizedPnL: 10000, estimatedTax: 2250, taxExempt: false });
  });

  it("o leilão de fração também conta para o limite", () => {
    const row = rowOf(
      [
        entry("PETR4", "BUY", 1, 10000, "2026-01-05"),
        entry("PETR4", "SELL", 1, 19999, "2026-04-10"),
        entry("VALE3", "BUY", 10.5, 4, "2026-01-05"),
        entry("VALE3", "SELL", 0.5, 4, "2026-04-15", "FRACAO"),
      ],
      "PETR4",
    );
    expect(row).toMatchObject({ realizedPnL: 9999, estimatedTax: 1499.85, taxExempt: false });
  });

  it("só prejuízo: sem IR e sem a marca de isento", () => {
    const row = rowOf(
      [entry("PETR4", "BUY", 100, 20, "2026-01-05"), entry("PETR4", "SELL", 100, 15, "2026-02-10")],
      "PETR4",
    );
    expect(row).toMatchObject({ realizedPnL: -500, estimatedTax: 0, taxExempt: false });
  });

  it("fora do mapa de classes, a classe sai pelo código", () => {
    const [row] = closedPositions(
      [
        entry("NEOE3", "BUY", 100, 17.54, "2021-01-26"),
        entry("NEOE3", "SELL", 100, 18.25, "2021-05-26"),
      ],
      new Map(),
    );
    expect(row).toMatchObject({
      ticker: "NEOE3",
      assetClass: "ACAO",
      estimatedTax: 0,
      taxExempt: true,
    });
  });
});

describe("closedPositions: visão Ações", () => {
  const classOf = (ticker: string) => classes.get(ticker) ?? null;
  const ledger = [
    entry("AAAA11", "BUY", 100, 10, "2026-01-05"),
    entry("AAAA11", "SELL", 100, 12, "2026-03-10"),
    // Março: R$ 25.000 em vendas de ações, acima da isenção.
    entry("PETR4", "BUY", 1000, 20, "2026-01-05"),
    entry("PETR4", "SELL", 1000, 25, "2026-03-10"),
    // Junho: R$ 5.000, isento.
    entry("VALE3", "BUY", 100, 40, "2026-01-05"),
    entry("VALE3", "SELL", 100, 50, "2026-06-10"),
  ];

  it("o IR de cada ação é o mesmo com o razão de ações e com o razão todo", () => {
    const all = closedPositions(ledger, classes);
    const stocks = closedPositions(byClass(ledger, classOf, "ACAO"), classes);
    for (const ticker of ["PETR4", "VALE3"]) {
      const a = all.find((row) => row.ticker === ticker)!;
      const b = stocks.find((row) => row.ticker === ticker)!;
      expect(b.estimatedTax).toBeCloseTo(a.estimatedTax, 6);
      expect(b.taxExempt).toBe(a.taxExempt);
    }
    expect(stocks.map((row) => row.ticker).sort()).toEqual(["PETR4", "VALE3"]);
  });
});
