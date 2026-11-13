import { describe, expect, it } from "vitest";
import { quoteSessionDate } from "./market-hours";
import { MARKET_INDICES, marketIndexFromQuote } from "./market-indices";

const now = new Date("2026-11-13T15:00:00Z");

describe("marketIndexFromQuote", () => {
  it("usa a variação do Yahoo e o pregão do horário da cotação", () => {
    const time = new Date("2026-11-13T14:21:00Z");
    expect(
      marketIndexFromQuote(
        { price: 3594.1, previousClose: 3566.57, changePercent: 0.0077, time },
        now,
      ),
    ).toEqual({
      price: 3594.1,
      previousClose: 3566.57,
      changePercent: 0.0077,
      session: quoteSessionDate(time),
    });
  });

  it("sem variação, calcula pelo fechamento anterior; sem horário, usa agora", () => {
    const value = marketIndexFromQuote(
      { price: 110, previousClose: 100, changePercent: null, time: null },
      now,
    );
    expect(value?.changePercent).toBeCloseTo(0.1);
    expect(value?.session).toEqual(quoteSessionDate(now));
  });

  it.each([
    { price: null, previousClose: 100, changePercent: 0.01, time: null },
    { price: 0, previousClose: 100, changePercent: 0.01, time: null },
    { price: 100, previousClose: null, changePercent: null, time: null },
  ])("recusa %j", (quote) => {
    expect(marketIndexFromQuote(quote, now)).toBeNull();
  });

  it("os dois índices e seus símbolos no Yahoo", () => {
    expect(MARKET_INDICES.map((i) => `${i.id}=${i.symbol}`)).toEqual([
      "IBOV=^BVSP",
      "IFIX=IFIX.SA",
    ]);
  });
});
