import { describe, expect, it } from "vitest";
import { healthCost, healthSteps } from "./health";

describe("healthCost", () => {
  it.each([
    [18, 290],
    [19, 350],
    [43, 550],
    [44, 735],
    [58, 1_200],
    [59, 1_725],
    [90, 1_725],
  ])("Conforto aos %i anos: R$ %i", (age, cost) => {
    expect(healthCost("conforto", age)).toBe(cost);
  });

  it("os outros padrões na mesma faixa", () => {
    expect(healthCost("basico", 40)).toBe(350);
    expect(healthCost("premium", 40)).toBe(850);
    expect(healthCost("premium", 60)).toBe(2_850);
  });

  it("sem plano é zero em toda faixa", () => {
    expect(healthCost("nenhum", 10)).toBe(0);
    expect(healthCost("nenhum", 70)).toBe(0);
  });
});

describe("healthSteps", () => {
  it("as faixas que começam depois da idade", () => {
    expect(healthSteps("conforto", 45)).toEqual([
      { age: 49, cost: 880 },
      { age: 54, cost: 1_200 },
      { age: 59, cost: 1_725 },
    ]);
  });

  it("aos 59 ou depois, e sem plano, não há degraus", () => {
    expect(healthSteps("conforto", 59)).toEqual([]);
    expect(healthSteps("nenhum", 30)).toEqual([]);
  });
});
