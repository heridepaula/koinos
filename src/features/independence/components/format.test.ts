import { describe, expect, it } from "vitest";
import { independenceSummary } from "../domain/plan";
import type { IndependencePlan } from "../domain/types";
import { forecastTitle, forecastVerdict, monthSlash, shortForecast } from "./format";

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

const summaryOf = (plan: IndependencePlan, koinosWealth: number, monthlyAporte: number) =>
  independenceSummary({ plan, koinosWealth, monthlyAporte, currentMonth: "2026-11" });

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

describe("forecastTitle e shortForecast", () => {
  it("a idade prevista, a meta alcançada ou sem previsão", () => {
    const late = summaryOf(example, 1_000_000, 8_000);
    expect(forecastTitle(late)).toBe("Aos ~55 anos");
    expect(shortForecast(late)).toBe("aos ~55");
    const reached = summaryOf(example, 9_000_000, 0);
    expect(forecastTitle(reached)).toBe("Meta alcançada");
    expect(shortForecast(reached)).toBe("meta alcançada");
    const stuck = summaryOf(example, 0, 0);
    expect(forecastTitle(stuck)).toBe("Sem previsão");
    expect(shortForecast(stuck)).toBe("sem previsão");
  });
});

describe("monthSlash", () => {
  it("AAAA-MM vira MM/AAAA", () => {
    expect(monthSlash("2042-09")).toBe("09/2042");
  });
});
