import { describe, expect, it } from "vitest";
import { sunoCascade } from "@/features/smart-buy";
import type { ClosedLedgerEntry } from "./closed-positions";
import { buildSnapshot, scopeToClass, type SnapshotInput } from "./snapshot";
import type { ClassFilter } from "@/shared/lib/class-filter";
import type { DividendEntry } from "@/features/transactions";
import type { AssetClass } from "@/features/market-data";
import type { PriceInfo, TargetConfig } from "./types";

const day = new Date(Date.UTC(2026, 0, 2));

const buy = (ticker: string, quantity: number): ClosedLedgerEntry => ({
  id: ticker,
  ticker,
  type: "BUY",
  quantity,
  unitPrice: 10,
  fees: 0,
  date: day,
  createdAt: day,
});

const target = (
  ticker: string,
  inStrategy: boolean,
  suggestedPercent: number | null,
  sunoRank: number | null,
): TargetConfig => ({
  ticker,
  inStrategy,
  sunoRank,
  ceilingPrice: 12,
  suggestedPercent,
  category: null,
});

const quote: PriceInfo = {
  name: null,
  logoUrl: null,
  subType: null,
  price: 10,
  changePercent: null,
  quoteFetchedAt: null,
  dy12m: null,
  lastDividend: null,
  priceToBook: null,
  dividends12m: null,
  fii: null,
};

/** Dois FIIs na estratégia (5% cada) e um em quarentena, fora dela, com a quantidade e a % dadas. */
function portfolio(quarantineShares: number, quarantinePercent: number | null): SnapshotInput {
  return {
    now: new Date(Date.UTC(2026, 9, 24)),
    transactions: [buy("AAAA11", 10), buy("BBBB11", 30), buy("QQQQ11", quarantineShares)],
    targets: [
      target("AAAA11", true, 5, 1),
      target("BBBB11", true, 5, 2),
      target("QQQQ11", false, quarantinePercent, null),
    ],
    dividends: [],
    prices: new Map([
      ["AAAA11", quote],
      ["BBBB11", quote],
      ["QQQQ11", quote],
    ]),
    classes: new Map(),
  };
}

describe("buildSnapshot: reescala de pesos com quarentena", () => {
  it("a quarentena fica fora da cascata e da base, e os pesos da estratégia fecham 100%", () => {
    const snapshot = buildSnapshot(portfolio(500, 0));
    expect(snapshot.cascadeInput.map((asset) => asset.ticker)).toEqual(["AAAA11", "BBBB11"]);
    expect(snapshot.cascadeInput.map((asset) => asset.weight)).toEqual([0.5, 0.5]);
    expect(snapshot.strategy.strategyValue).toBe(400);
    expect(snapshot.strategy.weightsWarning).toBe(
      "As % sugeridas somam 10,0%. Foram ajustadas proporcionalmente para 100%.",
    );
  });

  it("o valor e a % da quarentena não mudam as metas nem as ordens", () => {
    const small = buildSnapshot(portfolio(500, 0));
    const large = buildSnapshot(portfolio(50_000, 5));
    const ordersOf = (snapshot: typeof small) =>
      sunoCascade(1_000, snapshot.cascadeInput).orders.map((item) => [item.ticker, item.quantity]);
    // Metas de 700 (50% de 400 + 1.000): os dois pedem mais que o limite de 25% do aporte
    // (R$ 250, 25 cotas de R$ 10).
    expect(ordersOf(small)).toEqual([
      ["AAAA11", 25],
      ["BBBB11", 25],
    ]);
    expect(ordersOf(large)).toEqual(ordersOf(small));
  });

  it("na tabela de posições, a quarentena não tem meta nem prioridade", () => {
    const quarantined = buildSnapshot(portfolio(500, 0)).positions.find(
      (row) => row.ticker === "QQQQ11",
    )!;
    expect(quarantined).toMatchObject({ inStrategy: false, targetWeight: null, priority: null });
  });
});

describe("buildSnapshot: P/VP na cascata", () => {
  it("o P/VP do ativo chega à cascata; sem dado, fica nulo", () => {
    const input = portfolio(500, 0);
    const prices = new Map(input.prices);
    prices.set("AAAA11", { ...quote, priceToBook: 0.91 });
    const snapshot = buildSnapshot({ ...input, prices });
    expect(snapshot.cascadeInput.map((asset) => [asset.ticker, asset.priceToBook])).toEqual([
      ["AAAA11", 0.91],
      ["BBBB11", null],
    ]);
  });
});

describe("buildSnapshot: entrada do motor 3.0", () => {
  it("leva o perfil do FII, os proventos e os baldes de risco para a cascata", () => {
    const input = portfolio(500, 0);
    const prices = new Map(input.prices);
    prices.set("AAAA11", {
      ...quote,
      priceToBook: 0.9,
      lastDividend: { amount: 0.8, exDate: day },
      dividends12m: 9.6,
      fii: {
        vacancyPct: 5,
        segment: "Shoppings",
        fundType: "Tijolo",
        paperPct: 0,
        realEstatePct: 95,
      },
    });
    const [first, second] = buildSnapshot({ ...input, prices }).cascadeInput;
    expect(first).toMatchObject({
      ticker: "AAAA11",
      priceToBook: 0.9,
      lastDividend: 0.8,
      dividends12m: 9.6,
      vacancy: 0.05,
      macro: "Tijolo",
      sector: "Shoppings",
    });
    // Sem perfil e sem categoria na Carteira Alvo: tensores neutros e macro "Outros".
    expect(second).toMatchObject({
      ticker: "BBBB11",
      vacancy: null,
      macro: "Outros",
      sector: null,
    });
  });
});

describe("buildSnapshot: ações", () => {
  const withStock = (stockTarget: TargetConfig | null): SnapshotInput => {
    const input = portfolio(500, 0);
    return {
      ...input,
      transactions: [...input.transactions, buy("PETR4", 10)],
      targets: stockTarget ? [...input.targets, stockTarget] : input.targets,
      prices: new Map([...input.prices, ["PETR4", quote]]),
      classes: new Map<string, AssetClass | null>([["PETR4", "ACAO"]]),
    };
  };

  it("a ação fica fora da Carteira Alvo e do alerta de ativo sem configuração", () => {
    const snapshot = buildSnapshot(withStock(null));
    expect(snapshot.strategy.rows.map((row) => row.ticker)).not.toContain("PETR4");
    expect(snapshot.alerts.map((alert) => alert.id)).not.toContain("sem-configuracao");
  });

  it("entra nas posições com a classe e na composição como 'Ações'", () => {
    const snapshot = buildSnapshot(withStock(null));
    expect(snapshot.positions.find((row) => row.ticker === "PETR4")).toMatchObject({
      assetClass: "ACAO",
      category: "ACAO",
      inStrategy: false,
      priority: null,
    });
    expect(snapshot.allocation.byCategory).toContainEqual(
      expect.objectContaining({ key: "ACAO", label: "Ações" }),
    );
  });

  it("o ativo-alvo de ação não entra na cascata, mas está na estratégia das ações", () => {
    const snapshot = buildSnapshot(withStock(target("PETR4", true, 5, 3)));
    expect(snapshot.cascadeInput.map((asset) => asset.ticker)).toEqual(["AAAA11", "BBBB11"]);
    expect(snapshot.positions.find((row) => row.ticker === "PETR4")?.inStrategy).toBe(true);
  });
});

describe("scopeToClass: visões Geral, FIIs e Ações", () => {
  const dividend = (ticker: string, amount: number): DividendEntry => ({
    ticker,
    paidAt: new Date(Date.UTC(2026, 5, 15)),
    kind: "RENDIMENTO",
    amount,
    quantity: null,
    perShare: null,
  });
  const input: SnapshotInput = {
    now: new Date(Date.UTC(2026, 9, 31)),
    transactions: [buy("AAAA11", 10), buy("BBBB11", 30), buy("PETR4", 20)],
    targets: [target("AAAA11", true, 50, 1), target("BBBB11", true, 50, 2)],
    dividends: [dividend("AAAA11", 5), dividend("PETR4", 7)],
    prices: new Map([
      ["AAAA11", quote],
      ["BBBB11", quote],
      ["PETR4", quote],
    ]),
    classes: new Map<string, AssetClass | null>([
      ["AAAA11", "FII"],
      ["BBBB11", "FII"],
      ["PETR4", "ACAO"],
    ]),
  };
  const view = (filter: ClassFilter) => buildSnapshot(scopeToClass(input, filter));

  it("FIIs + Ações somam o Geral", () => {
    const [all, fiis, stocks] = [view("TODOS"), view("FII"), view("ACAO")];
    for (const key of ["patrimony", "invested", "dividendsReceived"] as const) {
      expect(fiis.summary[key] + stocks.summary[key]).toBeCloseTo(all.summary[key], 6);
    }
  });

  it("o % de cada visão é sobre a classe", () => {
    for (const filter of ["FII", "ACAO"] as const) {
      const total = view(filter).allocation.byAsset.reduce((sum, slice) => sum + slice.share, 0);
      expect(total).toBeCloseTo(1, 6);
    }
  });

  it("a visão Ações tem a estratégia das ações e nenhuma cascata", () => {
    const stocks = view("ACAO");
    expect(stocks.strategy.rows.map((row) => row.ticker)).toEqual(["PETR4"]);
    expect(stocks.cascadeInput).toEqual([]);
  });

  it("Geral devolve a entrada como veio", () => {
    expect(scopeToClass(input, "TODOS")).toBe(input);
  });
});

describe("buildSnapshot: Carteira Alvo de ações", () => {
  const input: SnapshotInput = {
    now: new Date(Date.UTC(2026, 9, 31)),
    transactions: [buy("AAAA11", 10), buy("BBBB11", 30), buy("PETR4", 20), buy("VALE3", 5)],
    targets: [
      target("AAAA11", true, 60, 1),
      target("BBBB11", true, 40, 2),
      { ...target("PETR4", true, 70, 1), category: "ACAO" },
      { ...target("VALE3", true, 30, 2), category: "ACAO" },
    ],
    dividends: [],
    prices: new Map(
      ["AAAA11", "BBBB11", "PETR4", "VALE3"].map((ticker) => [ticker, quote] as const),
    ),
    classes: new Map<string, AssetClass | null>([
      ["AAAA11", "FII"],
      ["BBBB11", "FII"],
      ["PETR4", "ACAO"],
      ["VALE3", "ACAO"],
    ]),
  };
  const fiiOnly: SnapshotInput = {
    ...input,
    targets: input.targets.filter((item) => !["PETR4", "VALE3"].includes(item.ticker)),
  };

  it("cada carteira fecha 100% sozinha", () => {
    const { positions } = buildSnapshot(input);
    const sum = (tickers: string[]) =>
      positions
        .filter((row) => tickers.includes(row.ticker))
        .reduce((total, row) => total + (row.targetWeight ?? 0), 0);
    expect(sum(["AAAA11", "BBBB11"])).toBeCloseTo(1, 6);
    expect(sum(["PETR4", "VALE3"])).toBeCloseTo(1, 6);
  });

  it("a cascata só tem FIIs e as ordens não mudam com as ações configuradas", () => {
    const withStocks = buildSnapshot(input);
    const without = buildSnapshot(fiiOnly);
    expect(withStocks.cascadeInput.map((asset) => asset.ticker)).toEqual(["AAAA11", "BBBB11"]);
    expect(withStocks.cascadeInput).toEqual(without.cascadeInput);
    expect(sunoCascade(10_000, withStocks.cascadeInput)).toEqual(
      sunoCascade(10_000, without.cascadeInput),
    );
  });

  it("em Geral, a ação configurada está na estratégia dela, sem prioridade de aporte", () => {
    const petr = buildSnapshot(input).positions.find((row) => row.ticker === "PETR4")!;
    expect(petr.inStrategy).toBe(true);
    expect(petr.targetWeight).toBeCloseTo(0.7, 6);
    expect(petr.priority).toBeNull();
  });

  it("Geral e FIIs: snapshot.strategy é a de FIIs", () => {
    expect(buildSnapshot(input).strategy.rows.map((row) => row.ticker)).toEqual([
      "AAAA11",
      "BBBB11",
    ]);
  });

  it("os alertas de 'fora da Carteira Alvo' seguem a visão", () => {
    const loose: SnapshotInput = {
      ...input,
      transactions: [...input.transactions, buy("ITUB4", 3), buy("CCCC11", 3)],
      prices: new Map([...input.prices, ["ITUB4", quote], ["CCCC11", quote]]),
      classes: new Map([...input.classes, ["ITUB4", "ACAO"], ["CCCC11", "FII"]]),
    };
    const alertOf = (filter: ClassFilter, id: string) =>
      buildSnapshot(scopeToClass(loose, filter)).alerts.find((alert) => alert.id === id);
    expect(alertOf("TODOS", "sem-configuracao-acoes")?.title).toContain(" (ações)");
    expect(alertOf("TODOS", "sem-configuracao")?.detail).toContain("CCCC11");
    const stocks = alertOf("ACAO", "sem-configuracao");
    expect(stocks?.title).toBe("Ativos fora da Carteira Alvo");
    expect(stocks?.detail).toContain("ITUB4");
    expect(alertOf("ACAO", "sem-configuracao-acoes")).toBeUndefined();
    expect(alertOf("FII", "sem-configuracao-acoes")).toBeUndefined();
    expect(alertOf("FII", "sem-configuracao")?.detail).not.toContain("ITUB4");
  });
});
