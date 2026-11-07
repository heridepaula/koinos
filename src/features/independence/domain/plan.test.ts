import { describe, expect, it } from "vitest";
import { defaultPlan } from "./catalog";
import {
  DEFAULT_MONTHLY_YIELD,
  durationLabel,
  grossIncome,
  independenceSummary,
  monthlyNeed,
  monthsToTarget,
  portfolioYield,
  targetMonthKey,
} from "./plan";
import type { IndependencePlan } from "./types";

const plan = (patch: Partial<IndependencePlan> = {}): IndependencePlan => ({
  ...defaultPlan(),
  ...patch,
});

describe("monthlyNeed", () => {
  it("soma o custo de vida, a saúde × pessoas e as viagens ÷ 12", () => {
    expect(
      monthlyNeed(
        plan({ livingCost: 7_500, people: 3, healthPerPerson: 800, travelPerYear: 24_000 }),
      ),
    ).toBe(7_500 + 2_400 + 2_000);
  });

  it("sem saúde nem viagens, é o custo de vida", () => {
    expect(monthlyNeed(plan({ livingCost: 4_000, healthPerPerson: 0, travelPerYear: 0 }))).toBe(
      4_000,
    );
  });
});

describe("grossIncome", () => {
  it.each([
    [0.2, 12_500],
    [0.25, 13_333.33],
    [0.3, 14_285.71],
  ])("com retenção de %s, R$ 10.000 líquidos pedem R$ %s brutos", (retention, gross) => {
    expect(grossIncome(10_000, retention)).toBeCloseTo(gross, 2);
  });
});

describe("portfolioYield", () => {
  it("é a média mensal recebida ÷ o patrimônio", () => {
    expect(portfolioYield(7_000, 1_000_000)).toEqual({ value: 0.007, source: "carteira" });
  });

  it.each([
    ["patrimônio zero", 500, 0],
    ["sem proventos", 0, 1_000_000],
    ["abaixo de 0,2% a.m.", 1_000, 1_000_000],
    ["acima de 1,5% a.m.", 20_000, 1_000_000],
    ["valor inválido", Number.NaN, 1_000_000],
  ])("%s usa o padrão de 0,6% a.m.", (_, dividends, patrimony) => {
    expect(portfolioYield(dividends, patrimony)).toEqual({
      value: DEFAULT_MONTHLY_YIELD,
      source: "padrao",
    });
  });

  it("os limites da faixa ainda valem como da carteira", () => {
    expect(portfolioYield(2_000, 1_000_000).source).toBe("carteira");
    expect(portfolioYield(15_000, 1_000_000).source).toBe("carteira");
  });
});

describe("monthsToTarget", () => {
  it("o exemplo da spec: 118 meses", () => {
    expect(monthsToTarget({ pv: 500_000, fv: 1_785_714.29, pmt: 5_000, r: 0.0056 })).toBe(118);
  });

  it("patrimônio na meta ou acima: prazo 0", () => {
    expect(monthsToTarget({ pv: 2_000_000, fv: 1_785_714.29, pmt: 0, r: 0.005 })).toBe(0);
    expect(monthsToTarget({ pv: 100, fv: 100, pmt: 0, r: 0 })).toBe(0);
  });

  it("taxa zero com aporte: a diferença ÷ o aporte, para cima", () => {
    expect(monthsToTarget({ pv: 0, fv: 10_000, pmt: 3_000, r: 0 })).toBe(4);
  });

  it("taxa zero sem aporte: sem prazo", () => {
    expect(monthsToTarget({ pv: 1_000, fv: 10_000, pmt: 0, r: 0 })).toBeNull();
  });

  it("sem aporte, só o yield faz o patrimônio crescer", () => {
    // 1.000 → 2.000 a 1% a.m.: ln 2 ÷ ln 1,01 = 69,66
    expect(monthsToTarget({ pv: 1_000, fv: 2_000, pmt: 0, r: 0.01 })).toBe(70);
  });

  it("sem patrimônio e sem aporte: sem prazo", () => {
    expect(monthsToTarget({ pv: 0, fv: 10_000, pmt: 0, r: 0.005 })).toBeNull();
  });
});

describe("targetMonthKey e durationLabel", () => {
  it("soma os meses ao mês atual, virando o ano", () => {
    expect(targetMonthKey("2026-11", 118)).toBe("2036-09");
    expect(targetMonthKey("2026-11", 2)).toBe("2027-01");
  });

  it.each([
    [118, "9 anos e 10 meses"],
    [12, "1 ano"],
    [13, "1 ano e 1 mês"],
    [5, "5 meses"],
    [1, "1 mês"],
    [0, "0 meses"],
  ])("%i meses: %s", (months, label) => {
    expect(durationLabel(months)).toBe(label);
  });
});

describe("independenceSummary", () => {
  it("o exemplo da spec: necessidade 10.000, retenção 20%, yield 0,7% a.m.", () => {
    const summary = independenceSummary({
      plan: plan({
        livingCost: 10_000,
        people: 1,
        healthPerPerson: 0,
        travelPerYear: 0,
        retention: 0.2,
      }),
      patrimony: 500_000,
      monthlyDividends: 3_500,
      monthlyAporte: 5_000,
      currentMonth: "2026-11",
    });
    expect(summary).toMatchObject({
      need: 10_000,
      gross: 12_500,
      monthlyYield: 0.007,
      yieldSource: "carteira",
      target: 1_785_714.29,
      months: 118,
      targetMonth: "2036-09",
    });
    expect(summary.realRate).toBeCloseTo(0.0056, 10);
    expect(summary.progress).toBeCloseTo(0.28, 2);
  });

  it("o progresso acima da meta é guardado inteiro", () => {
    const summary = independenceSummary({
      plan: plan({ livingCost: 1_000, healthPerPerson: 0, travelPerYear: 0, retention: 0.2 }),
      patrimony: 500_000,
      monthlyDividends: 3_500,
      monthlyAporte: 0,
      currentMonth: "2026-11",
    });
    expect(summary.progress).toBeGreaterThan(1);
    expect(summary.months).toBe(0);
    expect(summary.targetMonth).toBe("2026-11");
  });

  it("sem prazo nesse ritmo: meses e mês nulos", () => {
    const summary = independenceSummary({
      plan: plan(),
      patrimony: 0,
      monthlyDividends: 0,
      monthlyAporte: 0,
      currentMonth: "2026-11",
    });
    expect(summary.yieldSource).toBe("padrao");
    expect(summary.progress).toBe(0);
    expect(summary.months).toBeNull();
    expect(summary.targetMonth).toBeNull();
  });
});
