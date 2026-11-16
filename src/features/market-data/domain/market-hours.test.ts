import { describe, expect, it } from "vitest";
import {
  dayChangeLabel,
  isMarketOpen,
  isQuoteStale,
  marketSession,
  nextQuoteRefreshAt,
  quoteSessionDate,
} from "./market-hours";

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

describe("nextQuoteRefreshAt", () => {
  // Disparar nesse instante tem que encontrar a cotação vencida, senão a rodada se perde.
  const expectStaleAt = (fetchedAt: Date | null, now: Date) => {
    const next = nextQuoteRefreshAt(fetchedAt, now);
    expect(isQuoteStale(fetchedAt, next)).toBe(true);
    return next;
  };

  it("no pregão, 30 min e 1 s depois da busca", () => {
    const next = expectStaleAt(sp("2026-11-06T10:00"), sp("2026-11-06T10:05"));
    expect(next).toEqual(sp("2026-11-06T10:30:01"));
  });

  it("no pregão, sem cotação ou já vencida, é agora", () => {
    const now = sp("2026-11-06T11:00");
    expect(expectStaleAt(null, now)).toEqual(now);
    expect(expectStaleAt(sp("2026-11-06T10:00"), now)).toEqual(now);
  });

  it("às 17:59 espera até 18:29:01, ainda dentro da janela", () => {
    const next = expectStaleAt(sp("2026-11-06T17:59"), sp("2026-11-06T18:00"));
    expect(next).toEqual(sp("2026-11-06T18:29:01"));
  });

  it("uma busca às 18:29 vence no fim da janela (18:30)", () => {
    const next = expectStaleAt(sp("2026-11-06T18:29"), sp("2026-11-06T18:29:30"));
    expect(next).toEqual(sp("2026-11-06T18:30"));
  });

  it("a cotação das 18:30, em dia: a abertura do próximo dia útil", () => {
    const next = expectStaleAt(sp("2026-11-06T18:30"), sp("2026-11-06T18:30:01"));
    expect(next).toEqual(sp("2026-11-09T10:00"));
  });

  it("sexta à noite com a cotação do fechamento: segunda às 10:00", () => {
    const next = expectStaleAt(sp("2026-11-06T19:05"), sp("2026-11-06T22:00"));
    expect(next).toEqual(sp("2026-11-09T10:00"));
  });

  it("sábado e domingo com a cotação em dia: segunda às 10:00", () => {
    const saturday = expectStaleAt(sp("2026-11-06T19:05"), sp("2026-11-07T12:00"));
    expect(saturday).toEqual(sp("2026-11-09T10:00"));
    const sunday = expectStaleAt(sp("2026-11-06T19:05"), sp("2026-11-08T12:00"));
    expect(sunday).toEqual(sp("2026-11-09T10:00"));
  });

  it("antes da abertura de um dia útil com a cotação em dia: hoje às 10:00", () => {
    const next = expectStaleAt(sp("2026-11-05T19:05"), sp("2026-11-06T08:00"));
    expect(next).toEqual(sp("2026-11-06T10:00"));
  });

  it("fora do pregão com a cotação anterior ao fechamento: agora, uma busca para fechar o dia", () => {
    const now = sp("2026-11-07T12:00");
    expect(expectStaleAt(sp("2026-11-06T17:00"), now)).toEqual(now);
    expect(expectStaleAt(null, now)).toEqual(now);
  });
});
