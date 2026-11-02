import { describe, expect, it } from "vitest";
import { ENGINE_VERSIONS } from "./engine-options";
import { ACCUMULATION, fruition } from "./income-phase";
import {
  periodIncome,
  randomPricePaths,
  simulateAportes,
  type SimulationInput,
} from "./simulation";
import type { StockBuyAsset } from "./stock-buy";
import type { CascadeAsset } from "./fii-cascade";

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

describe("simulateAportes com fase (fruição)", () => {
  /** Dois FIIs de 50% e R$ 100, com 100 cotas cada e provento de R$ 1 por cota: renda de R$ 200. */
  const owned: SimulationInput = {
    fiis: [
      fii("AAAA11", { weight: 0.5, quantity: 100, lastDividend: 1 }),
      fii("BBBB11", { weight: 0.5, quantity: 100, lastDividend: 1, macro: "Papel", rank: 2 }),
    ],
    stocks: [stock("BBAS3", { quantity: 10 })],
  };
  const base = { fiisPercent: 100, options: ENGINE_VERSIONS["3.0"] };

  it("sem fase, os proventos ficam fora e o período não traz renda", () => {
    const [period] = simulateAportes(owned, { ...base, amount: 0, periods: 1 });
    expect(period.income).toBeNull();
    expect(period.fii).toBeNull();
  });

  it("na fruição sem aporte, só a retenção é investida, pelos mesmos motores", () => {
    const periods = simulateAportes(owned, {
      ...base,
      amount: 0,
      periods: 2,
      phase: fruition(0.5),
    });
    expect(periods[0].income).toEqual({ gross: 200, reinvest: 100, consume: 100 });
    expect(periods[0].fii!.amount).toBe(100);
    // A cota de R$ 100 passa da trava de 25% por FII de um aporte de R$ 100: nada é comprado.
    expect(periods[0].fii!.spent).toBe(0);
    expect(periods[0].fii!.leftover).toBe(100);
  });

  it("as cotas compradas com a retenção pagam no período seguinte", () => {
    // Cotas de R$ 10 com provento de R$ 0,10: renda de R$ 200 e retenção de R$ 100.
    const cheap: SimulationInput = {
      fiis: owned.fiis.map((asset) => ({
        ...asset,
        price: 10,
        quantity: 1_000,
        lastDividend: 0.1,
      })),
      stocks: [],
    };
    const periods = simulateAportes(cheap, {
      ...base,
      amount: 0,
      periods: 2,
      phase: fruition(0.5),
    });
    const first = periods[0];
    expect(first.fii!.spent + first.fii!.leftover).toBeCloseTo(100, 10);
    expect(first.fii!.spent).toBeGreaterThan(0);
    const bought = quantities(first.fiis).reduce((a, b) => a + b, 0) - 2_000;
    expect(periods[1].income!.gross).toBeCloseTo(200 + bought * 0.1, 10);
  });

  it("na acumulação, aporte e provento inteiro somam o valor do período", () => {
    const [period] = simulateAportes(owned, {
      ...base,
      amount: 1_000,
      periods: 1,
      phase: ACCUMULATION,
    });
    expect(period.income).toEqual({ gross: 200, reinvest: 200, consume: 0 });
    expect(period.fii!.amount).toBe(1_200);
  });

  it("acima do teto, a retenção não compra e fica em sobra", () => {
    const expensive: SimulationInput = {
      fiis: owned.fiis.map((asset) => ({ ...asset, ceiling: 90 })),
      stocks: [],
    };
    const [period] = simulateAportes(expensive, {
      ...base,
      amount: 0,
      periods: 1,
      phase: fruition(),
    });
    expect(period.income!.reinvest).toBe(50);
    expect(period.fii!.spent).toBe(0);
    expect(period.fii!.leftover).toBe(50);
  });

  it("a renda dos ativos fora da estratégia entra na renda e na retenção", () => {
    const [period] = simulateAportes(owned, {
      ...base,
      amount: 0,
      periods: 1,
      phase: fruition(),
      otherIncome: 100,
    });
    expect(period.income).toEqual({ gross: 300, reinvest: 75, consume: 225 });
    expect(period.fii!.amount).toBe(75);
  });

  it("as ações pagam pelo mapa de proventos; fora dele, nada", () => {
    expect(periodIncome(owned.fiis, owned.stocks)).toBe(200);
    expect(periodIncome(owned.fiis, owned.stocks, new Map([["BBAS3", 0.35]]))).toBe(203.5);
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
