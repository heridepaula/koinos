import { describe, expect, it } from "vitest";
import { dayMovers } from "./day-movers";
import type { PositionRow } from "./types";

const row = (ticker: string, changePercent: number | null, currentValue = 1000): PositionRow =>
  ({
    ticker,
    name: null,
    logoUrl: null,
    assetClass: "FII",
    price: 10,
    currentValue,
    changePercent,
  }) as PositionRow;

describe("dayMovers", () => {
  it("as 3 maiores altas e as 3 maiores baixas, da maior para a menor", () => {
    const rows = [
      row("AAAA11", 0.01),
      row("BBBB11", 0.03),
      row("CCCC11", 0.02),
      row("DDDD11", 0.005),
      row("EEEE11", -0.01),
      row("FFFF11", -0.04),
      row("GGGG11", -0.02),
      row("HHHH11", -0.001),
    ];
    const { gainers, losers } = dayMovers(rows);
    expect(gainers.map((m) => m.ticker)).toEqual(["BBBB11", "CCCC11", "AAAA11"]);
    expect(losers.map((m) => m.ticker)).toEqual(["FFFF11", "GGGG11", "EEEE11"]);
  });

  it("parado ou sem variação não entra; com menos de 3, mostra o que há", () => {
    const { gainers, losers } = dayMovers([
      row("AAAA11", 0),
      row("BBBB11", null),
      row("CCCC11", 0.01),
    ]);
    expect(gainers.map((m) => m.ticker)).toEqual(["CCCC11"]);
    expect(losers).toEqual([]);
  });

  it("o valor em R$ é o de hoje menos o de ontem", () => {
    const [mover] = dayMovers([row("AAAA11", 0.1, 1100)]).gainers;
    expect(mover.amount).toBeCloseTo(100);
    expect(mover.changePercent).toBe(0.1);
  });

  it("empate vai pelo ticker", () => {
    const { gainers } = dayMovers([row("BBBB11", 0.01), row("AAAA11", 0.01)]);
    expect(gainers.map((m) => m.ticker)).toEqual(["AAAA11", "BBBB11"]);
  });
});
