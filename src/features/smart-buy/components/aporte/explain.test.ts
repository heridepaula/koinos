import { describe, expect, it } from "vitest";
import type { CascadeOrder } from "../../domain/suno-cascade";
import { explain, shortReason } from "./explain";

const neutral = { valuation: 1, dividends: 1, safety: 1, vacancy: 1 };

function order(overrides: Partial<CascadeOrder> = {}): CascadeOrder {
  return {
    ticker: "AAAA11",
    rank: 3,
    quantity: 10,
    fromLeftover: 0,
    price: 100,
    total: 1_000,
    weightBefore: 0.04,
    weightAfter: 0.05,
    targetWeight: 0.05,
    marginToCeiling: 0.05,
    priceToBook: null,
    vacancy: null,
    dividendRatio: null,
    tensors: neutral,
    macro: "Tijolo",
    sector: null,
    fillBefore: 0.8,
    gapBefore: 2_000,
    need: 2_000,
    limitedBy: null,
    gapAfter: 1_000,
    ...overrides,
  };
}

describe("shortReason", () => {
  it("ranking, distância da meta e o sinal que mais pesou", () => {
    expect(
      shortReason(order({ priceToBook: 0.84, tensors: { ...neutral, valuation: 1.16 } })),
    ).toBe("3º do ranking · 20% abaixo da meta · P/VP 0,84");
  });

  it("um freio ou uma trava aparece antes do desconto", () => {
    expect(
      shortReason(
        order({ priceToBook: 0.7, tensors: { ...neutral, valuation: 1.3, dividends: 0.6 } }),
      ),
    ).toBe("3º do ranking · 20% abaixo da meta · provento caiu");
    expect(shortReason(order({ limitedBy: "setor", sector: "Shoppings" }))).toBe(
      "3º do ranking · 20% abaixo da meta · limite do setor",
    );
  });

  it("só da sobra: diz isso e onde o FII está em relação à meta", () => {
    expect(shortReason(order({ fromLeftover: 10, gapBefore: -50, fillBefore: 1.01 }))).toBe(
      "Sobra do aporte · já na meta",
    );
  });

  it("falta quase nada: não mostra 0%", () => {
    expect(shortReason(order({ fillBefore: 0.998 }))).toBe("3º do ranking · quase na meta");
  });
});

describe("explain", () => {
  it("lista cada tensor que mexeu no pedido, o pedido e a trava", () => {
    const parts = explain(
      order({
        priceToBook: 0.9,
        vacancy: 0.1,
        dividendRatio: 0.5,
        tensors: { valuation: 1.1, dividends: 0.5, safety: 1.05, vacancy: 0.9 },
        limitedBy: "ativo",
      }),
    );
    expect(parts).toContain("P/VP 0,9 (×1,1)");
    expect(parts).toContain("último provento 50% da média de 12 meses (×0,5)");
    expect(parts).toContain("vacância de 10,0% (×0,9)");
    expect(parts).toContain("limite de 25% do aporte por FII");
  });
});
