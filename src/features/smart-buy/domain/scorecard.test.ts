import { describe, expect, it } from "vitest";
import { ENGINE_VERSIONS, type EngineOptions } from "./engine-options";
import {
  countOutsideMethod,
  fiiTargetDeviation,
  rankWeightedAverage,
  scorecard,
} from "./scorecard";
import {
  randomPricePaths,
  simulateAportes,
  type SimulationInput,
  type SimulationParams,
} from "./simulation";
import type { StockBuyAsset } from "./stock-buy";
import type { CascadeAsset } from "./fii-cascade";

/** FII de teste: R$ 100 a cota, teto R$ 110 (tensor de segurança 1,0909), sem setor. */
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
    ceiling: 40,
    price: 30,
    quantity: 0,
    weight: 1,
    bias: null,
    ...overrides,
  };
}

/** Quatro FIIs de 25% (ranks 1 a 4), duas macros, e uma ação de R$ 30. */
const fourFiis = [
  fii("AAAA11", { rank: 1 }),
  fii("BBBB11", { rank: 2 }),
  fii("CCCC11", { rank: 3, macro: "Papel" }),
  fii("DDDD11", { rank: 4, macro: "Papel" }),
];
const input: SimulationInput = { fiis: fourFiis, stocks: [stock("BBAS3")] };

const params = (overrides: Partial<SimulationParams> = {}): SimulationParams => ({
  amount: 5_000,
  fiisPercent: 80,
  periods: 2,
  options: ENGINE_VERSIONS["3.0"],
  ...overrides,
});

describe("scorecard: % investido", () => {
  it("é o gasto ÷ (parte × períodos), por carteira e no total", () => {
    // FIIs: 4.000 por período, 10 cotas de cada (a trava de 25% corta em 1.000). Ação: 33 × 30 = 990.
    const card = scorecard(input, params());
    expect(card.investedPct.fii).toBe(1);
    expect(card.investedPct.stock).toBeCloseTo(0.99, 10);
    expect(card.investedPct.total).toBeCloseTo((8_000 + 1_980) / 10_000, 10);
    expect(card.stockIdle.perPeriod).toBeCloseTo(10, 10);
    expect(card.stockIdle.pct).toBeCloseTo(0.01, 10);
  });

  it("é nulo para a carteira sem parte do aporte", () => {
    // 5.000 só em FIIs: a trava de 1.250 deixa 12 cotas (1.200) de cada e 200 no caixa.
    const card = scorecard(input, params({ fiisPercent: 100 }));
    expect(card.investedPct.fii).toBeCloseTo(0.96, 10);
    expect(card.investedPct.stock).toBeNull();
    expect(card.investedPct.total).toBeCloseTo(0.96, 10);
    expect(card.stockIdle).toEqual({ perPeriod: 0, pct: null });
    expect(card.fiiOrders).toEqual({ perPeriod: 4, smallest: 1_200 });
    expect(card.fiisFunded).toBe(4);
    // Totais iguais nos ranks 1 a 4: a média ponderada é 2,5.
    expect(card.rankWeighted).toEqual({ fii: 2.5, stock: null });
  });

  it("com caminhos, é a média das simulações", () => {
    const flat = () => 1;
    expect(scorecard(input, params(), [flat, flat])).toEqual(scorecard(input, params()));
  });
});

describe("scorecard: desvio da meta e macros", () => {
  it("uma carteira já na meta, com um aporte que não compra nada, tem desvio zero", () => {
    const onTarget: SimulationInput = {
      fiis: [
        fii("AAAA11", { weight: 0.5, quantity: 10, macro: "Papel" }),
        fii("BBBB11", { rank: 2, weight: 0.5, quantity: 10 }),
      ],
      stocks: [],
    };
    // A trava de 25% de R$ 100 é R$ 25: não cabe nenhuma cota de R$ 100.
    const card = scorecard(onTarget, params({ amount: 100, fiisPercent: 100 }));
    expect(card.fiiOrders.perPeriod).toBe(0);
    expect(card.fiiDeviation).toEqual({ final: 0, average: 0 });
    expect(card.macro).toEqual([
      { macro: "Papel", weight: 0.5, target: 0.5 },
      { macro: "Tijolo", weight: 0.5, target: 0.5 },
    ]);
    expect(card.fiiOrders.smallest).toBeNull();
  });

  it("½ Σ |valor ÷ total − meta|: 3.000 e 1.000 contra 50% e 50% dão 0,25", () => {
    const fiis = [
      fii("AAAA11", { weight: 0.5, quantity: 30 }),
      fii("BBBB11", { weight: 0.5, quantity: 10 }),
    ];
    expect(fiiTargetDeviation(fiis)).toBeCloseTo(0.25, 10);
  });
});

describe("scorecard: rank ponderado pelo dinheiro", () => {
  it("(1 × 1.000 + 3 × 3.000) ÷ 4.000 = 2,5, sem as ordens de rank nulo", () => {
    expect(
      rankWeightedAverage([
        { rank: 1, total: 1_000 },
        { rank: 3, total: 3_000 },
        { rank: null, total: 5_000 },
      ]),
    ).toBe(2.5);
    expect(rankWeightedAverage([{ rank: null, total: 100 }])).toBeNull();
    expect(rankWeightedAverage([])).toBeNull();
  });
});

describe("scorecard: compras fora do método", () => {
  // Três FIIs que a 3.1 deixa de fora (acima do teto, Aguardar e suspenso) e uma ação acima do teto.
  const mixed: SimulationInput = {
    fiis: [
      ...fourFiis.map((asset) => ({ ...asset, weight: 1 / 7 })),
      fii("ABOV11", { rank: 5, weight: 1 / 7, price: 120, quantity: 10 }),
      fii("WAIT11", { rank: 6, weight: 1 / 7, bias: "AGUARDAR" }),
      fii("SUSP11", {
        rank: 7,
        weight: 1 / 7,
        macro: "Outros",
        daysSinceLastDividend: 60,
        dividendPayments12m: 12,
      }),
    ],
    stocks: [
      stock("BBAS3", { weight: 0.5, price: 10, ceiling: 15 }),
      stock("ABEV3", { rank: 2, weight: 0.5, price: 15, ceiling: 12, quantity: 100 }),
    ],
  };
  const options: EngineOptions = ENGINE_VERSIONS["3.1"];

  it("dá zero com os motores reais, com preços parados e sorteados", () => {
    const tickers = [...mixed.fiis, ...mixed.stocks].map((asset) => asset.ticker);
    const paths = Array.from({ length: 20 }, (_, index) =>
      randomPricePaths(100 + index, tickers, 6, { common: 0.025, own: 0.03 }),
    );
    for (const card of [
      scorecard(mixed, params({ amount: 20_000, fiisPercent: 50, periods: 6, options })),
      scorecard(mixed, params({ amount: 20_000, fiisPercent: 50, periods: 6, options }), paths),
    ]) {
      expect(card.outsideMethod).toBe(0);
      expect(card.fiiOrders.perPeriod).toBeGreaterThan(0);
      expect(card.stockOrders.perPeriod).toBeGreaterThan(0);
    }
  });

  it("conta a ordem que o método não permite", () => {
    // A 3.0 compra o SUSP11 (sem freio de suspensão); com as opções da 3.1, essa ordem está fora.
    const [period] = simulateAportes(
      mixed,
      params({ amount: 20_000, fiisPercent: 50, periods: 1 }),
    );
    expect(period.fii!.orders.some((order) => order.ticker === "SUSP11")).toBe(true);
    expect(countOutsideMethod(period, ENGINE_VERSIONS["3.0"])).toBe(0);
    expect(countOutsideMethod(period, options)).toBe(1);
    // Uma ação com o teto abaixo do preço da ordem também conta.
    const lowered = {
      ...period,
      stocks: period.stocks.map((asset) =>
        asset.ticker === "BBAS3" ? { ...asset, ceiling: 9.99 } : asset,
      ),
    };
    expect(countOutsideMethod(lowered, options)).toBe(2);
  });
});

describe("scorecard: estabilidade", () => {
  it("com um só FII elegível e aporte grande, o ruído não troca dinheiro de ativo", () => {
    const single: SimulationInput = {
      fiis: [
        fii("ONLY11", { weight: 0.5, price: 10, ceiling: 20 }),
        fii("ABOV11", { rank: 2, weight: 0.5, price: 30, ceiling: 20 }),
      ],
      stocks: [],
    };
    // Só o arredondamento em cotas muda o total (até R$ 10 em R$ 1.000.000).
    const card = scorecard(single, params({ amount: 1_000_000, fiisPercent: 100, periods: 1 }));
    expect(card.stability).toBeLessThan(1e-5);
  });

  it("é positiva quando o ruído empurra um FII para o teto, e a semente fixa repete o valor", () => {
    const edge: SimulationInput = {
      fiis: [
        fii("EDGE11", { weight: 0.5, price: 99.95, ceiling: 100 }),
        fii("SAFE11", { rank: 2, weight: 0.5, price: 10, ceiling: 20 }),
      ],
      stocks: [],
    };
    const edgeParams = params({ amount: 10_000, fiisPercent: 100, periods: 1 });
    const card = scorecard(edge, edgeParams);
    expect(card.stability).toBeGreaterThan(0.01);
    expect(scorecard(edge, edgeParams).stability).toBe(card.stability);
  });
});

describe("scorecard: freios, caixa e lotes das ações", () => {
  it("brakedShare é a fração do gasto em FIIs com freio de proventos ou de vacância", () => {
    // AAAA11 pagou metade da média: freio de 0,5. A sobra completa a ordem dele até a trava (1.000).
    const braked: SimulationInput = {
      fiis: fourFiis.map((asset) =>
        asset.ticker === "AAAA11" ? { ...asset, lastDividend: 0.5, dividends12m: 12 } : asset,
      ),
      stocks: [],
    };
    const card = scorecard(braked, params({ amount: 4_000, fiisPercent: 100, periods: 1 }));
    expect(card.investedPct.fii).toBe(1);
    expect(card.brakedShare).toBeCloseTo(0.25, 10);
  });

  it("lotsPerPeriod usa o lote das ordens: 100 na 3.1, 1 na 3.0", () => {
    // 5.000 em ações de R$ 30: na 3.1, 1 lote (3.000) e 2.000 parados; na 3.0, 166 ações e R$ 20.
    const stocksOnly: SimulationInput = { fiis: [], stocks: [stock("BBAS3")] };
    const v31 = scorecard(stocksOnly, params({ fiisPercent: 0, options: ENGINE_VERSIONS["3.1"] }));
    expect(v31.stockOrders).toEqual({ perPeriod: 1, lotsPerPeriod: 1 });
    expect(v31.stockIdle).toEqual({ perPeriod: 2_000, pct: 0.4 });
    expect(v31.investedPct.fii).toBeNull();

    const v30 = scorecard(stocksOnly, params({ fiisPercent: 0 }));
    expect(v30.stockOrders).toEqual({ perPeriod: 1, lotsPerPeriod: 166 });
    expect(v30.stockIdle.perPeriod).toBeCloseTo(20, 10);
  });
});
