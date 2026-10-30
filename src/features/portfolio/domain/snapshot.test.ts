import { describe, expect, it } from "vitest";
import { sunoCascade } from "@/features/smart-buy";
import type { ClosedLedgerEntry } from "./closed-positions";
import { buildSnapshot, type SnapshotInput } from "./snapshot";
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
    // Metas de 700 (50% de 400 + 1.000): o 1º para no limite de 33% do aporte (R$ 330, 33 cotas
    // de R$ 10), e o 2º na trava de 60% da macro que os dois dividem.
    expect(ordersOf(small)).toEqual([
      ["AAAA11", 33],
      ["BBBB11", 27],
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
