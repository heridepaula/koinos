import { describe, expect, it } from "vitest";
import type { RealizedSale } from "@/features/transactions";
import { apureMonthly } from "./monthly-apuration";

let id = 0;
const sale = (
  ticker: string,
  iso: string,
  quantity: number,
  unitPrice: number,
  cost: number,
  fees = 0,
): RealizedSale & { unitPrice: number } => {
  id += 1;
  return {
    entryId: `s${id}`,
    ticker,
    date: new Date(`${iso}T00:00:00Z`),
    kind: "NEGOCIO",
    quantity,
    proceeds: quantity * unitPrice - fees,
    cost,
    unitPrice,
  };
};

const run = (sales: ReturnType<typeof sale>[], openingLoss = { FII: 0, ACAO: 0 }) =>
  apureMonthly({
    sales,
    unitPriceOf: (entryId) => sales.find((s) => s.entryId === entryId)!.unitPrice,
    classOf: (t) => (t.endsWith("11") ? "FII" : t === "NADA0" ? null : "ACAO"),
    openingLoss,
    throughMonth: "2025-12",
  });

describe("apureMonthly", () => {
  it("FII: 20% do lucro, sem isenção", () => {
    const r = run([sale("AAAA11", "2025-03-10", 10, 15, 100)]);
    expect(r.months[0]).toMatchObject({ assetClass: "FII", result: 50, tax: 10, exempt: false });
  });

  it("FII: saldo de prejuízo reduz a base", () => {
    const r = run([sale("AAAA11", "2025-03-10", 10, 15, 100)], { FII: 20, ACAO: 0 });
    expect(r.months[0]).toMatchObject({
      lossCompensated: 20,
      taxableBase: 30,
      tax: 6,
      lossBalanceAfter: 0,
    });
  });

  it("ação até R$ 20 mil vendidos: isenta e sem consumir prejuízo", () => {
    const r = run([sale("BBBB3", "2025-03-10", 100, 100, 5000)], { FII: 0, ACAO: 100 });
    expect(r.months[0]).toMatchObject({
      exempt: true,
      tax: 0,
      lossCompensated: 0,
      lossBalanceAfter: 100,
    });
  });

  it("prejuízo de ação em mês isento entra no saldo", () => {
    const r = run([sale("BBBB3", "2025-03-10", 100, 40, 5000)]);
    expect(r.months[0]).toMatchObject({ exempt: false, result: -1000, lossBalanceAfter: 1000 });
    expect(r.closingLoss.ACAO).toBe(1000);
  });

  it("ação acima de R$ 20 mil: 15% depois de compensar", () => {
    const r = run([sale("BBBB3", "2025-03-10", 300, 100, 20000)], { FII: 0, ACAO: 1000 });
    // vendido 30.000, resultado 10.000, compensa 1.000, base 9.000, imposto 1.350
    expect(r.months[0]).toMatchObject({
      exempt: false,
      lossCompensated: 1000,
      taxableBase: 9000,
      tax: 1350,
    });
  });

  it("prejuízo de uma classe não compensa a outra", () => {
    const r = run([
      sale("AAAA11", "2025-03-10", 10, 5, 100), // FII −50
      sale("BBBB3", "2025-03-11", 300, 100, 20000), // ação +10.000, vendido 30.000
    ]);
    const stock = r.months.find((m) => m.assetClass === "ACAO")!;
    expect(stock.lossCompensated).toBe(0);
    expect(stock.tax).toBe(1500);
    expect(r.closingLoss.FII).toBe(50);
  });

  it("ignora incorporação e ticker sem classe", () => {
    const inc = { ...sale("AAAA11", "2025-03-10", 10, 15, 100), kind: "INCORPORACAO" as const };
    const r = run([inc, sale("NADA0", "2025-03-10", 10, 15, 100)]);
    expect(r.months).toEqual([]);
  });

  it("DARF abaixo de R$ 10 acumula para o mês seguinte", () => {
    const r = run([
      sale("AAAA11", "2025-03-10", 1, 130, 100), // lucro 30 → imposto 6
      sale("AAAA11", "2025-04-10", 1, 140, 100), // lucro 40 → imposto 8
    ]);
    expect(r.darf).toEqual([
      { month: "2025-03", tax: 6, due: 0, carriedOut: 6 },
      { month: "2025-04", tax: 8, due: 14, carriedOut: 0 },
    ]);
  });

  it("o saldo de prejuízo nunca fica negativo (500 casos com semente)", () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let n = 0; n < 500; n++) {
      const sales = Array.from({ length: 8 }, (_, i) =>
        sale(
          i % 2 ? "AAAA11" : "BBBB3",
          `2025-${String(1 + (i % 12)).padStart(2, "0")}-10`,
          10,
          10 + rnd() * 20,
          100 + rnd() * 100,
        ),
      );
      const r = run(sales, { FII: rnd() * 500, ACAO: rnd() * 500 });
      for (const m of r.months) expect(m.lossBalanceAfter).toBeGreaterThanOrEqual(0);
      expect(r.closingLoss.FII).toBeGreaterThanOrEqual(0);
      expect(r.closingLoss.ACAO).toBeGreaterThanOrEqual(0);
    }
  });
});
