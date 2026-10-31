// Testes do aporte combinado entre FIIs e ações (spec aporte por classe, §4.4).
import { describe, expect, it } from "vitest";
import { classAporte } from "./class-aporte";
import { sunoCascade, type CascadeAsset } from "./suno-cascade";

const asset = (patch: Partial<CascadeAsset> & { ticker: string }): CascadeAsset => ({
  rank: 1,
  ceiling: 110,
  weight: 1,
  price: 100,
  quantity: 0,
  averagePrice: null,
  priceToBook: null,
  lastDividend: null,
  dividends12m: null,
  vacancy: null,
  macro: "Tijolo",
  sector: null,
  ...patch,
});

describe("classAporte", () => {
  it("com meta 100% FIIs, igual à cascata só de FIIs e sem ações", () => {
    const fii = [asset({ ticker: "AAAA11", rank: 1, weight: 1, price: 10, ceiling: 20 })];
    const stock = [
      asset({ ticker: "PETR4", rank: 1, weight: 1, price: 30, ceiling: 50, macro: "Outros" }),
    ];
    const result = classAporte({
      amount: 1000,
      target: { fiiPercent: 100 },
      values: { FII: 0, ACAO: 0 },
      fii,
      stock,
    });
    expect(result.fii).toEqual(sunoCascade(1000, fii));
    expect(result.stock.orders).toEqual([]);
  });

  it("o troco das ações compra FIIs", () => {
    // Ações recebem 300 mas a cota custa 400: tudo vira troco e vai para os FIIs.
    const fii = [asset({ ticker: "AAAA11", rank: 1, weight: 1, price: 10, ceiling: 20 })];
    const stock = [
      asset({ ticker: "PETR4", rank: 1, weight: 1, price: 400, ceiling: 500, macro: "Outros" }),
    ];
    const result = classAporte({
      amount: 1000,
      target: { fiiPercent: 70 },
      values: { FII: 0, ACAO: 0 },
      fii,
      stock,
    });
    expect(result.split.ACAO.share).toBeCloseTo(300, 2);
    expect(result.stock.spent).toBe(0);
    expect(result.transfers.stockToFii).toBeCloseTo(300, 2);
    expect(result.fii.amount).toBeCloseTo(1000, 2);
  });

  it("o troco dos FIIs volta para as ações", () => {
    // FII de cota cara deixa troco; a ação barata absorve.
    const fii = [asset({ ticker: "AAAA11", rank: 1, weight: 1, price: 333, ceiling: 500 })];
    const stock = [
      asset({ ticker: "PETR4", rank: 1, weight: 1, price: 1, ceiling: 2, macro: "Outros" }),
    ];
    const result = classAporte({
      amount: 1000,
      target: { fiiPercent: 90 },
      values: { FII: 0, ACAO: 0 },
      fii,
      stock,
    });
    expect(result.transfers.fiiToStock).toBeGreaterThan(0);
    expect(result.stock.spent).toBeGreaterThan(100 - 1e-6);
  });

  it("gasto + troco = aporte, e nenhuma ação passa de 25% da parte final (200 carteiras)", () => {
    // Gerador determinístico (LCG), a mesma técnica de suno-cascade.test.ts.
    let state = 7;
    const next = () => {
      state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
      return state / 4_294_967_296;
    };
    const macros = ["Papel", "Tijolo", "Outros"] as const;
    const sectors = [null, null, "Shoppings", "Logística"];
    const build = (prefix: string, suffix: string, count: number, stock: boolean) =>
      Array.from({ length: count }, (_, index) => {
        const price = Math.round((5 + next() * 495) * 100) / 100;
        return asset({
          ticker: `${prefix}${String.fromCharCode(65 + index)}${suffix}`,
          rank: next() < 0.1 ? null : 1 + Math.floor(next() * 10),
          price,
          ceiling: price * (0.9 + next() * 0.4),
          weight: 1 / count,
          quantity: Math.floor(next() * 200),
          priceToBook: next() < 0.7 ? 0.6 + next() * 0.6 : null,
          lastDividend: next() < 0.7 ? next() : null,
          dividends12m: next() < 0.7 ? next() * 12 : null,
          vacancy: !stock && next() < 0.5 ? next() * 0.3 : null,
          macro: stock ? "Outros" : macros[Math.floor(next() * 3)]!,
          sector: stock ? null : sectors[Math.floor(next() * 4)]!,
        });
      });
    const worth = (assets: readonly CascadeAsset[]) =>
      assets.reduce((sum, item) => sum + item.quantity * (item.price ?? 0), 0);

    for (let run = 0; run < 200; run++) {
      const fii = build("F", "XX11", 2 + Math.floor(next() * 5), false);
      const stock = build("S", "XX3", 1 + Math.floor(next() * 5), true);
      const amount = Math.round(next() * 30_000 * 100) / 100;
      const fiiPercent = Math.round(next() * 100);
      const result = classAporte({
        amount,
        target: { fiiPercent },
        values: { FII: Math.min(worth(fii), 50_000), ACAO: Math.min(worth(stock), 50_000) },
        fii,
        stock,
      });
      expect(result.leftover).toBeGreaterThanOrEqual(-1e-6);
      expect(result.fii.spent + result.stock.spent + result.leftover).toBeCloseTo(amount, 2);
      for (const item of result.stock.orders) {
        expect(item.total).toBeLessThanOrEqual(0.25 * result.stock.amount + 1e-6);
      }
      if (fiiPercent === 0) expect(result.fii.spent).toBe(0);
    }
  });
});
