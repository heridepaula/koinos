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
      sunoCascade(200, snapshot.cascadeInput).orders.map((item) => [item.ticker, item.quantity]);
    // Metas de 300 (50% de 400 + 200): só o AAAA11, com 100, está abaixo. Com 16,7% de margem até
    // o teto, ele pede 200 × 1,2, e o saldo paga 20 cotas.
    expect(ordersOf(small)).toEqual([["AAAA11", 20]]);
    expect(ordersOf(large)).toEqual(ordersOf(small));
  });

  it("na tabela de posições, a quarentena não tem meta nem prioridade", () => {
    const quarantined = buildSnapshot(portfolio(500, 0)).positions.find(
      (row) => row.ticker === "QQQQ11",
    )!;
    expect(quarantined).toMatchObject({ inStrategy: false, targetWeight: null, priority: null });
  });
});
