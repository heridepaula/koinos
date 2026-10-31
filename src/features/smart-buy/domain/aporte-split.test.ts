import { describe, expect, it } from "vitest";
import { splitAmount } from "./aporte-split";

describe("splitAmount", () => {
  it("1024,10 a 100% fica todo nos FIIs", () => {
    expect(splitAmount(1024.1, 100)).toEqual({ fii: 1024.1, stock: 0 });
  });

  it("a 100%, nenhum centavo de 1000,00 a 1100,00 vai para as ações", () => {
    for (let cents = 100000; cents <= 110000; cents++) {
      const { fii, stock } = splitAmount(cents / 100, 100);
      expect(stock).toBe(0);
      expect(Math.round(fii * 100)).toBe(cents);
    }
  });

  it("a 50%, as partes somam o aporte exato em centavos", () => {
    for (let cents = 100000; cents <= 110000; cents++) {
      const { fii, stock } = splitAmount(cents / 100, 50);
      expect(Math.round(fii * 100) + Math.round(stock * 100)).toBe(cents);
    }
  });
});
