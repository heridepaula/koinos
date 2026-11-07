import { describe, expect, it } from "vitest";
import { dayChangeLabel, isMarketOpen, marketSession, quoteSessionDate } from "./market-hours";

// São Paulo é UTC−3 o ano todo (sem horário de verão desde 2019).
const sp = (iso: string) => new Date(`${iso}-03:00`);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("isMarketOpen", () => {
  it("abre às 10:00 e fecha às 18:00, de segunda a sexta", () => {
    expect(isMarketOpen(sp("2026-11-06T09:59"))).toBe(false);
    expect(isMarketOpen(sp("2026-11-06T10:00"))).toBe(true);
    expect(isMarketOpen(sp("2026-11-06T17:59"))).toBe(true);
    expect(isMarketOpen(sp("2026-11-06T18:00"))).toBe(false);
  });

  it("fica fechado no sábado e no domingo", () => {
    expect(isMarketOpen(sp("2026-11-07T12:00"))).toBe(false);
    expect(isMarketOpen(sp("2026-11-08T12:00"))).toBe(false);
  });
});

describe("quoteSessionDate", () => {
  it("é o próprio dia depois da abertura, até de noite", () => {
    expect(quoteSessionDate(sp("2026-11-06T19:29"))).toEqual(day("2026-11-06"));
    expect(quoteSessionDate(sp("2026-11-06T10:00"))).toEqual(day("2026-11-06"));
  });

  it("antes da abertura, é o dia útil anterior", () => {
    expect(quoteSessionDate(sp("2026-11-06T09:00"))).toEqual(day("2026-11-05"));
    // Segunda às 9h: a sexta.
    expect(quoteSessionDate(sp("2026-11-09T09:00"))).toEqual(day("2026-11-06"));
  });

  it("no fim de semana, é a sexta", () => {
    expect(quoteSessionDate(sp("2026-11-07T15:00"))).toEqual(day("2026-11-06"));
    expect(quoteSessionDate(sp("2026-11-08T23:00"))).toEqual(day("2026-11-06"));
  });
});

describe("marketSession e dayChangeLabel", () => {
  it("no sábado, com a cotação de sexta: fechado e o dia da variação", () => {
    const session = marketSession(sp("2026-11-07T14:00"), sp("2026-11-06T19:29"));
    expect(session).toEqual({ open: false, sessionDate: day("2026-11-06"), today: false });
    expect(dayChangeLabel(session)).toBe("na sex., 06/11");
  });

  it("no pregão, com a cotação de hoje: aberto e 'hoje'", () => {
    const session = marketSession(sp("2026-11-06T14:00"), sp("2026-11-06T13:40"));
    expect(session.open).toBe(true);
    expect(session.today).toBe(true);
    expect(dayChangeLabel(session)).toBe("hoje");
  });

  it("depois do fechamento, a variação ainda é de hoje", () => {
    const session = marketSession(sp("2026-11-06T21:00"), sp("2026-11-06T19:29"));
    expect(session.open).toBe(false);
    expect(dayChangeLabel(session)).toBe("hoje");
  });

  it("na abertura de segunda, antes de atualizar, a variação ainda é de sexta", () => {
    const session = marketSession(sp("2026-11-09T10:05"), sp("2026-11-06T19:29"));
    expect(session.open).toBe(true);
    expect(dayChangeLabel(session)).toBe("na sex., 06/11");
  });

  it("sem cotação, não há pregão", () => {
    const session = marketSession(sp("2026-11-07T14:00"), null);
    expect(session.sessionDate).toBeNull();
    expect(session.today).toBe(false);
  });
});
