import { describe, expect, it } from "vitest";
import { reportTickers, yearsWithActivity, resolveReportYear } from "./report-view";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("reportTickers", () => {
  it("junta os tickers do livro-razão e os que só aparecem por proventos, sem repetir", () => {
    const tickers = reportTickers(
      [{ ticker: "HGLG11" }, { ticker: "HGLG11" }, { ticker: "EGIE3" }],
      [{ ticker: "MALL11" }, { ticker: "EGIE3" }],
    );
    expect(tickers.sort()).toEqual(["EGIE3", "HGLG11", "MALL11"]);
  });
});

describe("yearsWithActivity", () => {
  it("lista os anos dos lançamentos e dos proventos, do mais recente ao mais antigo", () => {
    const years = yearsWithActivity(
      [{ date: d("2019-11-07") }, { date: d("2024-03-01") }, { date: d("2024-12-31") }],
      [{ paidAt: d("2025-01-02") }, { paidAt: d("2019-12-10") }],
    );
    expect(years).toEqual([2025, 2024, 2019]);
  });

  it("vazio sem lançamentos nem proventos", () => {
    expect(yearsWithActivity([], [])).toEqual([]);
  });
});

describe("resolveReportYear", () => {
  const at = (iso: string) => new Date(iso);

  it("até 30/04 o padrão é o ano anterior", () => {
    expect(resolveReportYear(undefined, at("2026-01-10T15:00:00Z"))).toBe(2025);
    expect(resolveReportYear(undefined, at("2026-04-30T20:00:00Z"))).toBe(2025);
  });

  it("de 1º/05 em diante o padrão é o ano corrente", () => {
    expect(resolveReportYear(undefined, at("2026-05-01T12:00:00Z"))).toBe(2026);
    expect(resolveReportYear(undefined, at("2026-11-16T12:00:00Z"))).toBe(2026);
  });

  it("usa o fuso de São Paulo na virada do prazo", () => {
    // 01/05 02:00 UTC ainda é 30/04 23:00 em São Paulo.
    expect(resolveReportYear(undefined, at("2026-05-01T02:00:00Z"))).toBe(2025);
  });

  it("aceita um ano inteiro de 2019 ao corrente", () => {
    const now = at("2026-11-16T12:00:00Z");
    expect(resolveReportYear("2019", now)).toBe(2019);
    expect(resolveReportYear("2024", now)).toBe(2024);
    expect(resolveReportYear("2026", now)).toBe(2026);
  });

  it("cai no padrão com ano fora da faixa ou que não é inteiro", () => {
    const now = at("2026-11-16T12:00:00Z");
    for (const raw of ["2018", "2027", "20x5", "2025.5", "", "-2025", ["2024", "2025"], null]) {
      expect(resolveReportYear(raw as never, now)).toBe(2026);
    }
  });
});
