import { describe, expect, it } from "vitest";
import { aportePriorities, sunoCascade } from "@/features/smart-buy";
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
  bias: null,
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

describe("buildSnapshot: viés nos FIIs (spec tabelas-unificadas, §3.3)", () => {
  const withBias = (bias: "COMPRAR" | "AGUARDAR", tickers: string[]): SnapshotInput => {
    const input = portfolio(500, 0);
    return {
      ...input,
      targets: input.targets.map((item) =>
        tickers.includes(item.ticker) ? { ...item, bias } : item,
      ),
    };
  };
  const ordersOf = (snapshot: ReturnType<typeof buildSnapshot>) =>
    sunoCascade(1_000, snapshot.cascadeInput).orders.map((item) => [item.ticker, item.quantity]);

  it("o viés chega à cascata e às linhas; Aguardar tira o FII do aporte com o motivo", () => {
    const snapshot = buildSnapshot(withBias("AGUARDAR", ["AAAA11"]));
    expect(snapshot.cascadeInput.map((asset) => [asset.ticker, asset.bias])).toEqual([
      ["AAAA11", "AGUARDAR"],
      ["BBBB11", null],
    ]);
    const waiting = { kind: "fora", reason: "AGUARDAR" };
    expect(aportePriorities(snapshot.cascadeInput).get("AAAA11")).toEqual(waiting);
    expect(snapshot.strategy.rows.find((row) => row.ticker === "AAAA11")).toMatchObject({
      bias: "AGUARDAR",
      priority: waiting,
    });
    expect(snapshot.positions.find((row) => row.ticker === "AAAA11")?.priority).toEqual(waiting);
    const result = sunoCascade(1_000, snapshot.cascadeInput);
    expect(result.excluded).toContainEqual({ ticker: "AAAA11", rank: 1, reason: "AGUARDAR" });
    expect(result.orders.map((order) => order.ticker)).toEqual(["BBBB11"]);
  });

  it("sem viés, ou com Comprar, a cascata de FIIs é a de antes", () => {
    const neutral = buildSnapshot(portfolio(500, 0));
    expect(neutral.cascadeInput.map((asset) => asset.bias)).toEqual([null, null]);
    expect(ordersOf(neutral)).toEqual([
      ["AAAA11", 25],
      ["BBBB11", 25],
    ]);
    expect(ordersOf(buildSnapshot(withBias("COMPRAR", ["AAAA11", "BBBB11"])))).toEqual(
      ordersOf(neutral),
    );
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
  // As % das ações somam 81,5 (71,5 + 10); as dos FIIs continuam em 100.
  const partial: SnapshotInput = {
    ...input,
    targets: input.targets.map((item) =>
      item.ticker === "PETR4"
        ? { ...item, suggestedPercent: 71.5 }
        : item.ticker === "VALE3"
          ? { ...item, suggestedPercent: 10 }
          : item,
    ),
  };

  it("stockBuyInput traz as ações da estratégia com o peso efetivo, a posição e o viés", () => {
    const { stockBuyInput } = buildSnapshot({
      ...input,
      targets: input.targets.map((item) =>
        item.ticker === "VALE3" ? { ...item, bias: "AGUARDAR" as const } : item,
      ),
    });
    expect(stockBuyInput).toEqual([
      { ticker: "PETR4", rank: 1, ceiling: 12, price: 10, quantity: 20, weight: 0.7, bias: null },
      {
        ticker: "VALE3",
        rank: 2,
        ceiling: 12,
        price: 10,
        quantity: 5,
        weight: 0.3,
        bias: "AGUARDAR",
      },
    ]);
  });

  it("stockBuyInput fica na ordem das linhas: rank, depois ticker", () => {
    const { stockBuyInput } = buildSnapshot({
      ...input,
      targets: input.targets.map((item) =>
        item.ticker === "PETR4" ? { ...item, sunoRank: 3 } : item,
      ),
    });
    expect(stockBuyInput.map((asset) => asset.ticker)).toEqual(["VALE3", "PETR4"]);
  });

  // Regra nova (spec tabelas-unificadas, §3.3): antes a % das ações valia como gravada (0,715 e
  // 0,10, o resto em caixa); agora reescala para 100% como nos FIIs.
  it("stockBuyInput reescala: com as % das ações somando 81,5, a de 10% pesa 10/81,5", () => {
    const { stockBuyInput } = buildSnapshot(partial);
    const [petr, vale] = stockBuyInput;
    expect(petr.weight).toBeCloseTo(71.5 / 81.5, 9);
    expect(vale.weight).toBeCloseTo(10 / 81.5, 9); // 0,1227
  });

  it("classValues soma o patrimônio", () => {
    const snapshot = buildSnapshot(input);
    expect(snapshot.classValues.FII + snapshot.classValues.ACAO).toBeCloseTo(
      snapshot.summary.patrimony,
      6,
    );
    expect(snapshot.classValues.ACAO).toBeCloseTo(250, 6); // 20 PETR4 + 5 VALE3 a R$ 10
  });

  it("as carteiras de FIIs e de ações fecham 100% cada uma, mesmo com as ações somando 81,5", () => {
    const sum = (rows: { ticker: string; targetWeight: number | null }[], tickers: string[]) =>
      rows
        .filter((row) => tickers.includes(row.ticker))
        .reduce((total, row) => total + (row.targetWeight ?? 0), 0);
    const { positions } = buildSnapshot(partial);
    expect(sum(positions, ["AAAA11", "BBBB11"])).toBeCloseTo(1, 6);
    expect(sum(positions, ["PETR4", "VALE3"])).toBeCloseTo(1, 6);
  });

  // Regra nova: antes era 0,10 (a % gravada) e sem aviso; agora reescala e avisa, como nos FIIs.
  it("ações somando 81,5: targetWeight é 10/81,5, com o aviso da soma e o alerta em Geral", () => {
    const warning = "As % sugeridas somam 81,5%. Foram ajustadas proporcionalmente para 100%.";
    const stocks = buildSnapshot(scopeToClass(partial, "ACAO"));
    const row = (ticker: string) => stocks.positions.find((item) => item.ticker === ticker)!;
    expect(row("VALE3").targetWeight).toBeCloseTo(10 / 81.5, 9);
    expect(row("PETR4").targetWeight).toBeCloseTo(71.5 / 81.5, 9);
    expect(stocks.strategy.weightsWarning).toBe(warning);
    expect(stocks.alerts.find((alert) => alert.id === "pesos")?.detail).toBe(warning);
    const all = buildSnapshot(partial);
    expect(all.alerts.find((alert) => alert.id === "pesos-acoes")).toMatchObject({
      title: "% sugeridas (ações)",
      detail: warning,
    });
    // FIIs inalterados: 60 + 40 fecham 100%, sem aviso.
    expect(all.strategy.rows.map((r) => r.targetWeight)).toEqual([0.6, 0.4]);
    expect(all.strategy.weightsWarning).toBeNull();
    expect(all.alerts.some((alert) => alert.id === "pesos")).toBe(false);
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

  // Regra nova: antes a ação não tinha prioridade; agora vem do motor de ações (stockPriorities).
  // Base de R$ 250 com aporte zero: PETR4 vale 200 e a meta é 175 (já na meta); VALE3 vale 50 e a
  // meta é 75, então pede 2 ações e é a 1ª da fila.
  it("em Geral, a posição da ação configurada tem a Prioridade do motor de ações", () => {
    const { positions } = buildSnapshot(input);
    const petr = positions.find((row) => row.ticker === "PETR4")!;
    expect(petr.inStrategy).toBe(true);
    expect(petr.targetWeight).toBeCloseTo(0.7, 6);
    expect(petr.priority).toEqual({ kind: "fora", reason: "NA_META" });
    expect(positions.find((row) => row.ticker === "VALE3")?.priority).toEqual({
      kind: "fila",
      position: 1,
    });
  });

  it("as linhas da Carteira Alvo de ações têm a Prioridade: a fila ou o motivo", () => {
    const priorityOf = (snapshot: ReturnType<typeof buildSnapshot>, ticker: string) =>
      snapshot.strategy.rows.find((row) => row.ticker === ticker)?.priority;
    const stocks = buildSnapshot(scopeToClass(input, "ACAO"));
    expect(priorityOf(stocks, "VALE3")).toEqual({ kind: "fila", position: 1 });
    expect(priorityOf(stocks, "PETR4")).toEqual({ kind: "fora", reason: "NA_META" });
    const waiting = buildSnapshot(
      scopeToClass(
        {
          ...input,
          targets: input.targets.map((item) =>
            item.ticker === "VALE3" ? { ...item, bias: "AGUARDAR" as const } : item,
          ),
        },
        "ACAO",
      ),
    );
    expect(waiting.strategy.rows.find((row) => row.ticker === "VALE3")?.bias).toBe("AGUARDAR");
    expect(priorityOf(waiting, "VALE3")).toEqual({ kind: "fora", reason: "AGUARDAR" });
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
