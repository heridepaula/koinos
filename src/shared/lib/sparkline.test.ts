import { describe, expect, it } from "vitest";
import { sparklinePath } from "./sparkline";

describe("sparklinePath", () => {
  it("estica os valores na largura, com o maior em cima", () => {
    expect(sparklinePath([1, 3, 2], 10, 10, 1)).toBe("M1.00 9.00 L5.00 1.00 L9.00 5.00");
  });

  it("deixa a série reta no meio", () => {
    expect(sparklinePath([4, 4], 20, 8, 1)).toBe("M1.00 4.00 L19.00 4.00");
  });

  it("é null com menos de dois valores", () => {
    expect(sparklinePath([], 10, 10)).toBeNull();
    expect(sparklinePath([5], 10, 10)).toBeNull();
  });
});
