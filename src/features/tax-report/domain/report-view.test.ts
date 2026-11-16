import { describe, expect, it } from "vitest";
import { reportTickers, yearsWithActivity } from "./report-view";

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
