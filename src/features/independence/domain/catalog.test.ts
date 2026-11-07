import { describe, expect, it } from "vitest";
import { DEFAULT_HEALTH_LEVEL, defaultPlan, HEALTH_LEVEL_LABELS, isHealthLevel } from "./catalog";
import { DEFAULT_TUITION } from "./constants";
import { HEALTH_LEVELS } from "./health";

describe("catálogo do questionário", () => {
  it("cada padrão de saúde tem texto, e o padrão é o Conforto", () => {
    for (const level of HEALTH_LEVELS) expect(HEALTH_LEVEL_LABELS[level].label).toBeTruthy();
    expect(DEFAULT_HEALTH_LEVEL).toBe("conforto");
  });

  it("o questionário em branco: R$ zerados, sem família, escola sugerida e custeio até 24", () => {
    expect(defaultPlan()).toMatchObject({
      externalWealth: 0,
      essentialMonthly: 0,
      seasonalYearly: 0,
      travelYearly: 0,
      spouseAge: null,
      dependents: 0,
      youngestAge: null,
      educationMonthly: DEFAULT_TUITION,
      educationUntil: 24,
      healthLevel: "conforto",
    });
  });

  it("isHealthLevel só aceita os quatro padrões", () => {
    expect(isHealthLevel("basico")).toBe(true);
    expect(isHealthLevel("vip")).toBe(false);
    expect(isHealthLevel(undefined)).toBe(false);
  });
});
