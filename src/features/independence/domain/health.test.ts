import { describe, expect, it } from "vitest";
import { healthCost, healthPerpetuity, healthSteps } from "./health";

const r = 0.004;

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

describe("healthPerpetuity", () => {
  it("sem degraus pela frente é a mensalidade ÷ r", () => {
    expect(healthPerpetuity("conforto", 60, r)).toBeCloseTo(1_725 / r, 6);
  });

  it("o titular do exemplo da spec (45 anos, Conforto): R$ 332.777,82", () => {
    expect(healthPerpetuity("conforto", 45, r)).toBeCloseTo(332_777.82, 2);
  });

  it("cada degrau custa mais quanto mais perto ele está", () => {
    expect(healthPerpetuity("conforto", 50, r)).toBeGreaterThan(
      healthPerpetuity("conforto", 45, r),
    );
    expect(healthPerpetuity("conforto", 45, r)).toBeLessThan(1_725 / r);
  });

  it("sem plano é zero", () => {
    expect(healthPerpetuity("nenhum", 45, r)).toBe(0);
  });
});
