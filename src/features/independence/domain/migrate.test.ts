import { describe, expect, it } from "vitest";
import { defaultPlan } from "./catalog";
import { draftFromV1 } from "./migrate";

describe("draftFromV1", () => {
  it("aproveita o gasto fixo, as viagens e o padrão de saúde; o resto fica no padrão", () => {
    expect(
      draftFromV1({ livingCost: 7_500, travelPerYear: 15_000, answers: { health: "premium" } }),
    ).toEqual({
      ...defaultPlan(),
      essentialMonthly: 7_500,
      travelYearly: 15_000,
      healthLevel: "premium",
    });
  });

  it("campos ausentes ou inválidos viram o padrão", () => {
    expect(draftFromV1({ livingCost: -1, travelPerYear: "x", answers: { health: "vip" } })).toEqual(
      defaultPlan(),
    );
    expect(draftFromV1({})).toEqual(defaultPlan());
  });
});
