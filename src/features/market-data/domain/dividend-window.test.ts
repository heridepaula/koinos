import { describe, expect, it } from "vitest";
import { dividendWindow, nextLastDividend, toDividendEntries } from "./dividend-window";

const DAY_MS = 86_400_000;
const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

/** Um provento por mês, no dia `day`, de `from` (ano, mês) até `to` (ano, mês), inclusive. */
function monthly(
  from: [number, number],
  to: [number, number],
  day: number,
  amount = 1,
  skip: ReadonlySet<string> = new Set(),
) {
  const entries: { exDate: Date; amount: number }[] = [];
  let [year, month] = from;
  while (year < to[0] || (year === to[0] && month <= to[1])) {
    if (!skip.has(`${year}-${month}`)) entries.push({ exDate: utc(year, month, day), amount });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return entries;
}

describe("dividendWindow", () => {
  it("13 datas ex em 365 dias somam 12 na janela de calendário", () => {
    const now = utc(2026, 10, 31);
    // Fim de mês, de out/2025 a out/2026: 13 datas, a mais antiga a 365 dias de hoje.
    const dividends = Array.from({ length: 13 }, (_, index) => ({
      exDate: utc(2025, 11 + index, 0),
      amount: 0.5,
    }));
    expect(dividends).toHaveLength(13);
    expect(now.getTime() - dividends[0].exDate.getTime()).toBeLessThanOrEqual(365 * DAY_MS);

    const result = dividendWindow(dividends, now);
    expect(result.payments).toBe(12);
    expect(result.total).toBeCloseTo(6, 10);
    expect(result.last?.exDate).toEqual(utc(2026, 10, 31));
  });

  it("um mês sem pagamento soma 11", () => {
    const now = utc(2026, 11, 15);
    const dividends = monthly([2025, 10], [2026, 10], 10, 1, new Set(["2026-3"]));
    const result = dividendWindow(dividends, now);
    expect(result.payments).toBe(11);
    expect(result.total).toBe(11);
  });

  it("último provento de mais de 365 dias: total e contagem zeram, mas o último vem", () => {
    const now = utc(2026, 11, 1);
    const lastExDate = new Date(now.getTime() - 400 * DAY_MS);
    const result = dividendWindow(
      [
        { exDate: new Date(lastExDate.getTime() - 30 * DAY_MS), amount: 0.8 },
        { exDate: lastExDate, amount: 0.9 },
      ],
      now,
    );
    expect(result.total).toBe(0);
    expect(result.payments).toBe(0);
    expect(result.last).toEqual({ exDate: lastExDate, amount: 0.9 });
  });

  it("dois pagamentos no mesmo mês contam os dois", () => {
    const now = utc(2026, 11, 15);
    const result = dividendWindow(
      [
        { exDate: utc(2026, 9, 10), amount: 1 },
        { exDate: utc(2026, 10, 5), amount: 1.5 },
        { exDate: utc(2026, 10, 28), amount: 0.25 },
      ],
      now,
    );
    expect(result.payments).toBe(3);
    expect(result.total).toBe(2.75);
    expect(result.last).toEqual({ exDate: utc(2026, 10, 28), amount: 0.25 });
  });

  it("sem proventos: último nulo e somas zero", () => {
    expect(dividendWindow([], utc(2026, 11, 1))).toEqual({
      total: 0,
      trailingTotal: 0,
      payments: 0,
      last: null,
    });
  });

  it("a janela termina no mês do último, não em hoje", () => {
    // Pagou de jan a ago/2026 (8 meses) e parou: hoje é nov/2026, dentro de 365 dias.
    const now = utc(2026, 11, 1);
    const result = dividendWindow(monthly([2026, 1], [2026, 8], 12, 1), now);
    expect(result.payments).toBe(8);
    expect(result.total).toBe(8);
  });
});

describe("nextLastDividend", () => {
  const stored = { amount: 0.9, exDate: utc(2026, 9, 10) };
  const fresh = { amount: 1, exDate: utc(2026, 10, 10) };

  it("busca sem proventos devolve o guardado", () => {
    expect(nextLastDividend(null, stored)).toBe(stored);
  });

  it("busca com proventos devolve o novo", () => {
    expect(nextLastDividend(fresh, stored)).toBe(fresh);
  });

  it("sem nada guardado nem buscado, fica nulo", () => {
    expect(nextLastDividend(null, null)).toBeNull();
  });
});

describe("trailingTotal e toDividendEntries", () => {
  it("FII que parou: a janela soma 12, o DY dos últimos 12 meses só 7", () => {
    const result = dividendWindow(monthly([2025, 6], [2026, 5], 15), utc(2026, 11, 1));
    expect(result.total).toBe(12);
    expect(result.trailingTotal).toBe(7);
  });

  it("FII em dia: os dois totais coincidem", () => {
    const result = dividendWindow(monthly([2025, 11], [2026, 10], 15), utc(2026, 11, 1));
    expect(result.trailingTotal).toBe(result.total);
  });

  it("último provento velho: zero nos dois", () => {
    const result = dividendWindow(monthly([2024, 1], [2024, 12], 15), utc(2026, 11, 1));
    expect(result.trailingTotal).toBe(0);
  });

  it("a data ex do Yahoo vira data de negócio: 13:00Z e perto da meia-noite UTC", () => {
    const [noon, late] = toDividendEntries([
      { exDate: new Date("2026-05-15T13:00:00Z"), amount: 1 },
      { exDate: new Date("2026-05-16T02:30:00Z"), amount: 2 },
    ]);
    expect(noon.exDate.toISOString()).toBe("2026-05-15T00:00:00.000Z");
    // 02:30Z ainda é o dia 15 em São Paulo (23:30).
    expect(late.exDate.toISOString()).toBe("2026-05-15T00:00:00.000Z");
  });
});
