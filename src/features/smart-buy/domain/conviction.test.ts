import { describe, expect, it } from "vitest";
import {
  dividendRatio,
  dividendTensor,
  safetyTensor,
  vacancyTensor,
  valuationTensor,
} from "./conviction";

describe("valuationTensor", () => {
  it("1 + (1 − P/VP): acelera o descontado e freia o ágio", () => {
    expect(valuationTensor(0.9)).toBeCloseTo(1.1);
    expect(valuationTensor(1.05)).toBeCloseTo(0.95);
  });

  it("sem P/VP é neutro, e nunca fica negativo", () => {
    expect(valuationTensor(null)).toBe(1);
    expect(valuationTensor(2.5)).toBe(0);
  });
});

describe("dividendTensor (freio de corte)", () => {
  it("último provento ÷ média mensal de 12 meses, no máximo 1", () => {
    expect(dividendTensor(0.5, 12)).toBeCloseTo(0.5);
    expect(dividendTensor(1.2, 12)).toBe(1);
    expect(dividendRatio(1.2, 12)).toBeCloseTo(1.2);
  });

  it("sem histórico é neutro; provento zerado freia tudo", () => {
    expect(dividendTensor(null, 12)).toBe(1);
    expect(dividendTensor(1, 0)).toBe(1);
    expect(dividendTensor(0, 12)).toBe(0);
  });
});

describe("safetyTensor", () => {
  it("1 + margem até o teto", () => {
    expect(safetyTensor(0.2)).toBeCloseTo(1.2);
    expect(safetyTensor(0)).toBe(1);
  });
});

describe("vacancyTensor", () => {
  it("1 − vacância, só em tijolo", () => {
    expect(vacancyTensor(0.25, "Tijolo")).toBeCloseTo(0.75);
    expect(vacancyTensor(0.25, "Papel")).toBe(1);
    expect(vacancyTensor(null, "Tijolo")).toBe(1);
  });
});
