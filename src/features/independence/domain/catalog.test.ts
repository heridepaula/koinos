import { describe, expect, it } from "vitest";
import { DEFAULT_RETENTION, MIN_RETENTION } from "@/features/smart-buy";
import {
  DEFAULT_ANSWERS,
  defaultPlan,
  HEALTH_OPTIONS,
  LIVING_OPTIONS,
  PEOPLE_OPTIONS,
  RETENTION_OPTIONS,
  TRAVEL_OPTIONS,
} from "./catalog";

describe("catálogo do questionário", () => {
  it("cada passo tem a opção padrão entre as suas", () => {
    expect(LIVING_OPTIONS.map((o) => o.key)).toContain(DEFAULT_ANSWERS.living);
    expect(PEOPLE_OPTIONS.map((o) => o.key)).toContain(DEFAULT_ANSWERS.people);
    expect(HEALTH_OPTIONS.map((o) => o.key)).toContain(DEFAULT_ANSWERS.health);
    expect(TRAVEL_OPTIONS.map((o) => o.key)).toContain(DEFAULT_ANSWERS.travel);
  });

  it("as retenções nunca ficam abaixo do piso da fruição", () => {
    for (const retention of RETENTION_OPTIONS)
      expect(retention).toBeGreaterThanOrEqual(MIN_RETENTION);
    expect(RETENTION_OPTIONS).toContain(DEFAULT_RETENTION);
  });

  it("o plano padrão usa os R$ das opções padrão e a retenção da fruição", () => {
    expect(defaultPlan()).toEqual({
      answers: DEFAULT_ANSWERS,
      livingCost: 7_500,
      people: 1,
      healthPerPerson: 800,
      travelPerYear: 15_000,
      retention: DEFAULT_RETENTION,
    });
  });
});
