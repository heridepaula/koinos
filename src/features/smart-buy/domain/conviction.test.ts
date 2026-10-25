import { describe, expect, it } from "vitest";
import { marginMultiplier, priceToBookMultiplier } from "./conviction";

describe("marginMultiplier", () => {
  it("acelera com mais de 5% de margem até o teto", () => {
    expect(marginMultiplier(0.0501)).toBe(1.2);
    expect(marginMultiplier(0.26)).toBe(1.2);
  });

  it("não muda o pedido com 5% de margem ou menos", () => {
    expect(marginMultiplier(0.05)).toBe(1);
    expect(marginMultiplier(0.002)).toBe(1);
  });
});

describe("priceToBookMultiplier", () => {
  it("acelera abaixo de 0,95", () => {
    expect(priceToBookMultiplier(0.9499)).toBe(1.2);
  });

  it("é neutro de 0,95 a 1,00, com as duas pontas", () => {
    expect(priceToBookMultiplier(0.95)).toBe(1);
    expect(priceToBookMultiplier(0.98)).toBe(1);
    expect(priceToBookMultiplier(1)).toBe(1);
  });

  it("corta o pedido pela metade com ágio, acima de 1,00", () => {
    expect(priceToBookMultiplier(1.0001)).toBe(0.5);
    expect(priceToBookMultiplier(1.3)).toBe(0.5);
  });

  it("é neutro sem P/VP ou com P/VP inválido", () => {
    expect(priceToBookMultiplier(null)).toBe(1);
    expect(priceToBookMultiplier(0)).toBe(1);
    expect(priceToBookMultiplier(Number.NaN)).toBe(1);
  });
});
