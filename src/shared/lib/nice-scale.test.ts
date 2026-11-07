import { describe, expect, it } from "vitest";
import { niceScale } from "./nice-scale";

describe("niceScale", () => {
  it("usa um passo redondo e um domínio que cobre os valores", () => {
    const scale = niceScale([151.2, 158.4, 163.9]);
    expect(scale.step).toBe(5);
    expect(scale.domain).toEqual([150, 165]);
    expect(scale.ticks).toEqual([150, 155, 160, 165]);
  });

  it("vai aos centavos em séries de preço baixo", () => {
    const scale = niceScale([9.62, 9.81, 9.7]);
    expect(scale.step).toBeCloseTo(0.05);
    expect(scale.domain).toEqual([9.6, 9.85]);
    expect(scale.ticks[0]).toBe(9.6);
    expect(scale.ticks.at(-1)).toBe(9.85);
  });

  it("abre um passo para cada lado quando os valores são iguais", () => {
    const scale = niceScale([10, 10]);
    expect(scale.domain[0]).toBeLessThan(10);
    expect(scale.domain[1]).toBeGreaterThan(10);
  });
});
