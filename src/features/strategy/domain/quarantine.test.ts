import { describe, expect, it } from "vitest";
import { suggestedPercentProblem, ZERO_PERCENT_IN_STRATEGY } from "./quarantine";

describe("suggestedPercentProblem", () => {
  it("aceita 0% fora da estratégia: é a quarentena", () => {
    expect(suggestedPercentProblem(0, false)).toBeNull();
  });

  it("recusa 0% na estratégia", () => {
    expect(suggestedPercentProblem(0, true)).toBe(ZERO_PERCENT_IN_STRATEGY);
  });

  it("aceita % vazia ou positiva nos dois casos", () => {
    for (const inStrategy of [true, false]) {
      expect(suggestedPercentProblem(null, inStrategy)).toBeNull();
      expect(suggestedPercentProblem(5, inStrategy)).toBeNull();
    }
  });
});
