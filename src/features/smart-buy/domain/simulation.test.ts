import { describe, expect, it } from "vitest";
import { ENGINE_VERSIONS } from "./engine-options";
import { randomPricePaths, simulateAportes, type SimulationInput } from "./simulation";
import type { StockBuyAsset } from "./stock-buy";
import type { CascadeAsset } from "./suno-cascade";

/** FII de teste: R$ 100 a cota, teto R$ 110, sem setor. */
function fii(ticker: string, overrides: Partial<CascadeAsset> = {}): CascadeAsset {
  return {
    ticker,
    rank: 1,
    ceiling: 110,
    weight: 0.25,
    price: 100,
    quantity: 0,
    averagePrice: null,
    priceToBook: null,
    lastDividend: null,
    dividends12m: null,
    vacancy: null,
    macro: "Tijolo",
    sector: null,
    ...overrides,
  };
}

function stock(ticker: string, overrides: Partial<StockBuyAsset> = {}): StockBuyAsset {
  return {
    ticker,
    rank: 1,
    ceiling: 30,
    price: 20,
    quantity: 0,
    weight: 1,
    bias: null,
    ...overrides,
  };
}

/**
 * Quatro FIIs de 25%, duas macros: cada um pede 1.000 × 1,0909 e a trava de 25% corta em 1.000, então
 * um aporte de 4.000 compra 10 cotas de cada. A ação única compra 1.000 ÷ 20 = 50 ações por período.
 */
const input: SimulationInput = {
  fiis: [
    fii("AAAA11", { rank: 1 }),
    fii("BBBB11", { rank: 2 }),
    fii("CCCC11", { rank: 3, macro: "Papel" }),
    fii("DDDD11", { rank: 4, macro: "Papel" }),
  ],
  stocks: [stock("BBAS3")],
};

const quantities = (assets: readonly { quantity: number }[]) => assets.map((a) => a.quantity);

describe("simulateAportes", () => {
  it("com preços parados, soma as quantidades compradas a cada período", () => {
    const periods = simulateAportes(input, {
      amount: 5_000,
      fiisPercent: 80,
      periods: 2,
      options: ENGINE_VERSIONS["3.0"],
    });
    expect(periods).toHaveLength(2);
    expect(quantities(periods[0].fiis)).toEqual([10, 10, 10, 10]);
    expect(quantities(periods[0].stocks)).toEqual([50]);
    // O segundo aporte vê a carteira do primeiro: estratégia de 4.000 e metas de 2.000.
    expect(periods[1].fii!.strategyValue).toBe(4_000);
    expect(periods[1].stock!.base).toBe(2_000);
    expect(quantities(periods[1].fiis)).toEqual([20, 20, 20, 20]);
    expect(quantities(periods[1].stocks)).toEqual([100]);
    // A entrada não muda.
    expect(quantities(input.fiis)).toEqual([0, 0, 0, 0]);
  });

  it("uma parte zero dá resultado nulo e não mexe na carteira daquela classe", () => {
    const periods = simulateAportes(input, {
      amount: 4_000,
      fiisPercent: 100,
      periods: 1,
      options: ENGINE_VERSIONS["3.0"],
    });
    expect(periods[0].stock).toBeNull();
    expect(quantities(periods[0].stocks)).toEqual([0]);
    expect(periods[0].fii!.spent).toBe(4_000);
  });

  it("aplica o fator do período ao preço, em centavos, e ao P/VP dos FIIs", () => {
    const priced: SimulationInput = {
      fiis: [fii("AAAA11", { priceToBook: 0.9 }), fii("BBBB11", { priceToBook: null })],
      stocks: [stock("BBAS3")],
    };
    const periods = simulateAportes(priced, {
      amount: 1_000,
      fiisPercent: 50,
      periods: 2,
      options: ENGINE_VERSIONS["3.0"],
      prices: (period) => (period === 0 ? 1 : 1.03333),
    });
    expect(periods[0].fiis[0].price).toBe(100);
    expect(periods[0].fiis[0].priceToBook).toBe(0.9);
    expect(periods[1].fiis[0].price).toBe(103.33);
    expect(periods[1].fiis[0].priceToBook).toBeCloseTo(0.9 * 1.03333, 10);
    expect(periods[1].fiis[1].priceToBook).toBeNull();
    expect(periods[1].stocks[0].price).toBe(20.67);
    // O teto não anda com o preço.
    expect(periods[1].fiis[0].ceiling).toBe(110);
  });
});

describe("randomPricePaths", () => {
  const tickers = ["AAAA11", "BBBB11", "BBAS3"];
  const sigma = { common: 0.025, own: 0.03 };
  const grid = (path: ReturnType<typeof randomPricePaths>) =>
    [0, 1, 2, 3, 4, 5].flatMap((period) => tickers.map((ticker) => path(period, ticker)));

  it("a mesma semente dá os mesmos fatores; outra semente, outros", () => {
    const first = grid(randomPricePaths(7, tickers, 6, sigma));
    expect(grid(randomPricePaths(7, tickers, 6, sigma))).toEqual(first);
    expect(grid(randomPricePaths(8, tickers, 6, sigma))).not.toEqual(first);
  });

  it("o período 0 tem fator 1 e um ticker desconhecido também", () => {
    const path = randomPricePaths(7, tickers, 6, sigma);
    for (const ticker of tickers) expect(path(0, ticker)).toBe(1);
    expect(path(1, "AAAA11")).not.toBe(1);
    expect(path(3, "XXXX11")).toBe(1);
  });

  it("sem fator próprio, todos os ativos andam juntos; sem σ, nada anda", () => {
    const common = randomPricePaths(3, tickers, 6, { common: 0.05, own: 0 });
    for (let period = 1; period < 6; period++) {
      expect(common(period, "BBBB11")).toBe(common(period, "AAAA11"));
      expect(common(period, "BBAS3")).toBe(common(period, "AAAA11"));
    }
    const still = randomPricePaths(3, tickers, 6, { common: 0, own: 0 });
    expect(grid(still).every((factor) => factor === 1)).toBe(true);
  });
});
