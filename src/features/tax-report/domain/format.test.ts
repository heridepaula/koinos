import { describe, expect, it } from "vitest";
import { formatMoney, formatPrice, round2 } from "./format";

describe("format", () => {
  it("round2 arredonda ao centavo", () => {
    expect(round2(1.005 + 1e-9)).toBe(1.01);
    expect(round2(-0.004)).toBe(-0);
  });
  it("formatMoney usa milhar com ponto e 2 casas", () => {
    expect(formatMoney(1234.5)).toBe("1.234,50");
    expect(formatMoney(0)).toBe("0,00");
  });
  it("formatPrice mostra de 2 a 4 casas", () => {
    expect(formatPrice(12.3456)).toBe("12,3456");
    expect(formatPrice(12.3)).toBe("12,30");
  });
});
