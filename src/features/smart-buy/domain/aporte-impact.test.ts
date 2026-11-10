import { describe, expect, it } from "vitest";
import { orderImpact, portfolioImpact } from "./aporte-impact";

const order = (quantity: number, price: number) => ({ quantity, price, total: quantity * price });

function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

describe("orderImpact: preço médio", () => {
  it("com posição, pondera as cotas antigas e as novas", () => {
    const impact = orderImpact("FII", order(10, 90), { quantity: 30, averagePrice: 100 });
    expect(impact.quantityBefore).toBe(30);
    expect(impact.quantityAfter).toBe(40);
    expect(impact.averagePriceBefore).toBe(100);
    expect(impact.averagePriceAfter).toBeCloseTo(97.5, 10);
  });

  it("sem posição, o depois é o preço da ordem e o antes é null", () => {
    const impact = orderImpact("FII", order(10, 90), { quantity: 0, averagePrice: null });
    expect(impact.averagePriceBefore).toBeNull();
    expect(impact.averagePriceAfter).toBe(90);
    expect(impact.resultPercentBefore).toBeNull();
    expect(impact.resultPercentAfter).toBe(0);
  });

  it("com posição mas sem preço médio, o depois é o preço da ordem", () => {
    const impact = orderImpact("ACAO", order(100, 12), { quantity: 50 });
    expect(impact.averagePriceBefore).toBeNull();
    expect(impact.averagePriceAfter).toBe(12);
  });
});

describe("orderImpact: L/P", () => {
  it("o % se dilui na direção de zero", () => {
    const impact = orderImpact("FII", order(10, 90), { quantity: 30, averagePrice: 100 });
    expect(impact.resultPercentBefore).toBeCloseTo(-0.1, 10);
    expect(impact.resultPercentAfter).toBeCloseTo(90 / 97.5 - 1, 10);
  });

  it("em R$ o resultado não muda, em 500 casos sorteados", () => {
    const next = random(42);
    for (let i = 0; i < 500; i++) {
      const quantity = 1 + Math.floor(next() * 500);
      const averagePrice = 5 + next() * 200;
      const price = 5 + next() * 200;
      const bought = 1 + Math.floor(next() * 300);
      const impact = orderImpact("FII", order(bought, price), { quantity, averagePrice });
      const before = (price - averagePrice) * quantity;
      const after = (price - impact.averagePriceAfter) * impact.quantityAfter;
      expect(after).toBeCloseTo(before, 6);
    }
  });
});

describe("orderImpact: renda e YOC", () => {
  it("FII: cotas × último provento", () => {
    const impact = orderImpact("FII", order(10, 90), {
      quantity: 30,
      averagePrice: 100,
      lastDividend: 0.8,
      dividends12m: 9.6,
    });
    expect(impact.monthlyIncome).toBeCloseTo(8, 10);
    expect(impact.yieldOnCostBefore).toBeCloseTo(0.096, 10);
    expect(impact.yieldOnCostAfter).toBeCloseTo(9.6 / 97.5, 10);
  });

  it("ação: ações × 12 meses ÷ 12, ignorando o último provento", () => {
    const impact = orderImpact("ACAO", order(100, 20), {
      quantity: 0,
      lastDividend: 3,
      dividends12m: 2.4,
    });
    expect(impact.monthlyIncome).toBeCloseTo(20, 10);
    expect(impact.yieldOnCostBefore).toBeNull();
    expect(impact.yieldOnCostAfter).toBeCloseTo(0.12, 10);
  });

  it("sem dado de proventos, renda e YOC são null", () => {
    const fii = orderImpact("FII", order(10, 90), { quantity: 30, averagePrice: 100 });
    expect(fii.monthlyIncome).toBeNull();
    expect(fii.yieldOnCostBefore).toBeNull();
    expect(fii.yieldOnCostAfter).toBeNull();
    const stock = orderImpact("ACAO", order(100, 20), { quantity: 0, dividends12m: 0 });
    expect(stock.monthlyIncome).toBeNull();
  });
});

describe("portfolioImpact", () => {
  it("patrimônio depois = antes + gasto; soma a renda e conta quem ficou sem dado", () => {
    const a = order(10, 90);
    const b = order(100, 20);
    const c = order(5, 50);
    const result = portfolioImpact(
      [
        { order: a, impact: orderImpact("FII", a, { quantity: 0, lastDividend: 0.8 }) },
        { order: b, impact: orderImpact("ACAO", b, { quantity: 0, dividends12m: 2.4 }) },
        { order: c, impact: orderImpact("FII", c, { quantity: 0 }) },
      ],
      10_000,
    );
    expect(result.valueBefore).toBe(10_000);
    expect(result.valueAfter).toBe(10_000 + 900 + 2_000 + 250);
    expect(result.monthlyIncome).toBeCloseTo(8 + 20, 10);
    expect(result.incomeMissing).toBe(1);
  });

  it("sem ordens, nada muda", () => {
    expect(portfolioImpact([], 500)).toEqual({
      valueBefore: 500,
      valueAfter: 500,
      monthlyIncome: 0,
      incomeMissing: 0,
    });
  });
});
