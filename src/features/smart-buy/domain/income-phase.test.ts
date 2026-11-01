import { describe, expect, it } from "vitest";
import {
  ACCUMULATION,
  DEFAULT_RETENTION,
  fruition,
  MIN_RETENTION,
  splitIncome,
} from "./income-phase";

describe("fruition", () => {
  it("sem argumento, retém 25% (o estudo da live de Baroni)", () => {
    expect(DEFAULT_RETENTION).toBe(0.25);
    expect(fruition()).toEqual({ kind: "FRUICAO", retention: 0.25 });
  });

  it("aceita de 20% a 100% e recusa o resto: o saque total fica barrado", () => {
    expect(MIN_RETENTION).toBe(0.2);
    expect(fruition(0.2).retention).toBe(0.2);
    expect(fruition(0.24).retention).toBe(0.24);
    expect(fruition(1).retention).toBe(1);
    for (const bad of [0, 0.19, 1.01, -0.25, Number.NaN]) {
      expect(() => fruition(bad)).toThrow(RangeError);
    }
  });
});

describe("splitIncome", () => {
  it("na acumulação, todo o provento volta para a carteira", () => {
    expect(splitIncome(1_234.56, ACCUMULATION)).toEqual({ reinvest: 1_234.56, consume: 0 });
  });

  it("na fruição, retém a fração e libera o resto", () => {
    expect(splitIncome(10_000, fruition())).toEqual({ reinvest: 2_500, consume: 7_500 });
    expect(splitIncome(10_000, fruition(0.24))).toEqual({ reinvest: 2_400, consume: 7_600 });
  });

  it("trabalha em centavos, arredondando a retenção para cima, e as partes somam o provento", () => {
    // 0,25 × 100,01 = 25,0025: retém 25,01 (nunca menos que a fração) e libera 75,00.
    expect(splitIncome(100.01, fruition())).toEqual({ reinvest: 25.01, consume: 75 });
    for (const income of [0.01, 0.03, 99.99, 1_000.07, 12_345.67]) {
      for (const retention of [0.2, 0.24, 0.25, 1 / 3, 1]) {
        const { reinvest, consume } = splitIncome(income, fruition(retention));
        expect(Math.round((reinvest + consume) * 100)).toBe(Math.round(income * 100));
        expect(reinvest).toBeGreaterThanOrEqual(income * retention - 1e-9);
        expect(consume).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("provento zero, negativo ou inválido não gera nada", () => {
    for (const income of [0, -10, Number.NaN]) {
      expect(splitIncome(income, fruition())).toEqual({ reinvest: 0, consume: 0 });
      expect(splitIncome(income, ACCUMULATION)).toEqual({ reinvest: 0, consume: 0 });
    }
  });
});
