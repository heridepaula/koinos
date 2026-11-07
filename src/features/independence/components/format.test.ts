import { describe, expect, it } from "vitest";
import { independenceSummary } from "../domain/plan";
import type { IndependencePlan } from "../domain/types";
import { REAL_MONTHLY_RATE, REINVESTMENT_SHARE } from "../domain/constants";
import { forecastTitle, forecastVerdict, monthSlash, yieldLabel } from "./format";

/** O exemplo da spec v2 §2.6: aos ~55, alvo 45. */
const example: IndependencePlan = {
  currentAge: 40,
  targetAge: 45,
  externalWealth: 0,
  essentialMonthly: 10_000,
  seasonalYearly: 12_000,
  travelYearly: 24_000,
  spouseAge: 38,
  dependents: 2,
  youngestAge: 6,
  educationMonthly: 2_500,
  educationUntil: 24,
  healthLevel: "conforto",
};

/** O DY (ao ano) que dá os 0,4% a.m. reais da v2: com ele valem os 190 meses do exemplo. */
const V2_YIELD = (12 * REAL_MONTHLY_RATE) / (1 - REINVESTMENT_SHARE * (1 + REAL_MONTHLY_RATE));

const summaryOf = (
  plan: IndependencePlan,
  koinosWealth: number,
  monthlyAporte: number,
  portfolioYield: number | null = V2_YIELD,
) =>
  independenceSummary({
    plan,
    koinosWealth,
    monthlyAporte,
    portfolioYield,
    currentMonth: "2026-11",
  });

describe("forecastVerdict", () => {
  it("depois da idade alvo: âmbar, com a diferença em anos e meses", () => {
    const summary = summaryOf(example, 1_000_000, 8_000); // 190 meses; a idade alvo está a 60
    expect(forecastVerdict(example, summary)).toEqual({
      tone: "warn",
      text: "10 anos e 10 meses depois dos 45",
    });
  });

  it("antes da idade alvo: verde, com a folga do domínio", () => {
    const plan = { ...example, targetAge: 60 };
    const summary = summaryOf(plan, 1_000_000, 8_000); // 179 meses de 240
    expect(summary.slackMonths).toBe(61);
    expect(forecastVerdict(plan, summary)).toEqual({
      tone: "gain",
      text: "5 anos e 1 mês antes dos 60",
    });
  });

  it("meta alcançada e sem previsão", () => {
    expect(forecastVerdict(example, summaryOf(example, 9_000_000, 0))).toEqual({
      tone: "gain",
      text: "Meta alcançada",
    });
    expect(forecastVerdict(example, summaryOf(example, 0, 0))).toEqual({
      tone: "neutral",
      text: "Sem previsão no ritmo de hoje",
    });
  });

  it("idade alvo hoje: todo o prazo conta como atraso", () => {
    const plan = { ...example, targetAge: 40 };
    const summary = summaryOf(plan, 1_000_000, 8_000); // 190 meses
    expect(forecastVerdict(plan, summary)).toEqual({
      tone: "warn",
      text: "15 anos e 10 meses depois dos 40",
    });
  });
});

describe("forecastTitle", () => {
  it("a idade prevista, a meta alcançada ou sem previsão", () => {
    expect(forecastTitle(summaryOf(example, 1_000_000, 8_000))).toBe("Aos ~55 anos");
    expect(forecastTitle(summaryOf(example, 9_000_000, 0))).toBe("Meta alcançada");
    expect(forecastTitle(summaryOf(example, 0, 0))).toBe("Sem previsão");
  });
});

describe("yieldLabel", () => {
  it("o DY dos ativos ou, sem DY ainda, o rendimento de referência", () => {
    expect(yieldLabel(summaryOf(example, 1_000_000, 8_000, 0.132))).toBe(
      "o DY de 13,2% ao ano dos seus ativos",
    );
    expect(yieldLabel(summaryOf(example, 1_000_000, 8_000, null))).toBe(
      "o rendimento de referência de 9,5% ao ano",
    );
  });
});

describe("monthSlash", () => {
  it("AAAA-MM vira MM/AAAA", () => {
    expect(monthSlash("2042-09")).toBe("09/2042");
  });
});
