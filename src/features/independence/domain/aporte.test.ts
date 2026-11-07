import { describe, expect, it } from "vitest";
import type { LedgerEntry, TransactionKind } from "@/features/transactions";
import { APORTE_MONTHS, averageMonthlyAporte, cashSales, closedMonths } from "./aporte";

let id = 0;
function entry(
  type: "BUY" | "SELL",
  quantity: number,
  unitPrice: number,
  date: string,
  kind?: TransactionKind,
  fees = 0,
): LedgerEntry {
  id += 1;
  const day = new Date(`${date}T00:00:00Z`);
  return {
    id: String(id),
    ticker: "HGLG11",
    type,
    quantity,
    unitPrice,
    fees,
    date: day,
    createdAt: day,
    kind,
  };
}

describe("closedMonths", () => {
  it("os 12 meses fechados antes do atual (a média anual), do mais antigo ao mais novo", () => {
    expect(APORTE_MONTHS).toBe(12);
    expect(closedMonths("2026-11")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
  });

  it("vira o ano", () => {
    expect(closedMonths("2027-02", 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});

describe("cashSales", () => {
  it("soma as vendas em dinheiro do mês (negócio, sem kind e leilão de fração), menos as taxas", () => {
    const entries = [
      entry("SELL", 10, 100, "2026-10-05", "NEGOCIO", 1),
      entry("SELL", 5, 100, "2026-10-06"),
      entry("SELL", 0.5, 80, "2026-10-07", "FRACAO"),
      entry("SELL", 100, 50, "2026-10-08", "INCORPORACAO"),
      entry("BUY", 10, 100, "2026-10-09"),
      entry("SELL", 3, 100, "2026-09-30"),
    ];
    expect(cashSales(entries, "2026-10")).toBe(999 + 500 + 40);
  });
});

describe("averageMonthlyAporte", () => {
  it("é a média do bolso menos as vendas, com mês vazio contando zero", () => {
    expect(
      averageMonthlyAporte([
        { fromPocket: 6_000, sales: 0 },
        { fromPocket: 0, sales: 0 },
        { fromPocket: 3_000, sales: 0 },
      ]),
    ).toBe(3_000);
  });

  it("as vendas abatem, e um mês negativo abate os outros", () => {
    expect(
      averageMonthlyAporte([
        { fromPocket: 6_000, sales: 0 },
        { fromPocket: 0, sales: 2_000 },
      ]),
    ).toBe(2_000);
  });

  it("o piso é zero, só na média", () => {
    expect(
      averageMonthlyAporte([
        { fromPocket: 1_000, sales: 0 },
        { fromPocket: 0, sales: 5_000 },
      ]),
    ).toBe(0);
  });

  it("sem meses, zero", () => {
    expect(averageMonthlyAporte([])).toBe(0);
  });
});
