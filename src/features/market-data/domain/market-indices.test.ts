import { describe, expect, it } from "vitest";
import { isQuoteStale, quoteSessionDate } from "./market-hours";
import {
  INDEX_CLOSES_KEPT,
  isIndexStale,
  MARKET_INDICES,
  marketIndexFromQuote,
  nextIndexCloses,
} from "./market-indices";

const now = new Date("2026-11-13T15:00:00Z");

describe("nextIndexCloses", () => {
  const day = (d: number) => new Date(Date.UTC(2026, 10, d));

  it("acrescenta o pregão novo e mantém a ordem", () => {
    const stored = [
      { session: day(11), close: 3598.12 },
      { session: day(12), close: 3567.01 },
    ];
    expect(nextIndexCloses(stored, { session: day(13), price: 3600.7 })).toEqual([
      ...stored,
      { session: day(13), close: 3600.7 },
    ]);
  });

  it("a leitura do mesmo pregão substitui o fechamento dele; sem histórico, começa", () => {
    const stored = [
      { session: day(12), close: 3567.01 },
      { session: day(13), close: 3590 },
    ];
    expect(nextIndexCloses(stored, { session: day(13), price: 3600.7 })).toEqual([
      { session: day(12), close: 3567.01 },
      { session: day(13), close: 3600.7 },
    ]);
    expect(nextIndexCloses(undefined, { session: day(13), price: 1 })).toEqual([
      { session: day(13), close: 1 },
    ]);
  });

  it(`guarda só os ${INDEX_CLOSES_KEPT} pregões mais recentes`, () => {
    const stored = Array.from({ length: INDEX_CLOSES_KEPT }, (_, i) => ({
      session: new Date(Date.UTC(2026, 8, 1 + i)),
      close: i,
    }));
    const next = nextIndexCloses(stored, { session: day(13), price: 99 });
    expect(next).toHaveLength(INDEX_CLOSES_KEPT);
    expect(next[0].close).toBe(1);
    expect(next.at(-1)).toEqual({ session: day(13), close: 99 });
  });
});

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

describe("isIndexStale", () => {
  const session = new Date("2026-11-13T15:00:00Z"); // sexta, 12:00 em São Paulo
  const ago = (min: number) => new Date(session.getTime() - min * 60_000);

  it("no pregão, atualiza a partir de 25 min", () => {
    expect(isIndexStale(ago(24), session)).toBe(false);
    expect(isIndexStale(ago(25), session)).toBe(true);
    expect(isIndexStale(ago(30), session)).toBe(true);
    expect(isQuoteStale(ago(25), session)).toBe(false);
  });

  it("sem leitura, está vencido", () => {
    expect(isIndexStale(null, session)).toBe(true);
    expect(isIndexStale(undefined, session)).toBe(true);
  });

  it("fora do pregão, segue o isQuoteStale", () => {
    const night = new Date("2026-11-13T23:00:00Z"); // 20:00 em São Paulo
    for (const fetchedAt of [new Date("2026-11-13T20:00:00Z"), new Date("2026-11-13T21:40:00Z")]) {
      expect(isIndexStale(fetchedAt, night)).toBe(isQuoteStale(fetchedAt, night));
    }
  });
});
