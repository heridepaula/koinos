import { describe, expect, it } from "vitest";
import { effectiveWeights, suggestPercentFix } from "./weights";

const items = (...percents: (number | null)[]) =>
  percents.map((suggestedPercent, index) => ({ ticker: `FII${index}`, suggestedPercent }));

describe("effectiveWeights", () => {
  it("sem nenhuma %, todos têm o mesmo peso", () => {
    const { weights, warning } = effectiveWeights(items(null, null));
    expect([...weights.values()]).toEqual([0.5, 0.5]);
    expect(warning).toBeNull();
  });

  it("os sem % dividem igualmente o que falta para 100%", () => {
    const { weights, warning } = effectiveWeights(items(60, null, null));
    expect(weights.get("FII0")).toBeCloseTo(0.6);
    expect(weights.get("FII1")).toBeCloseTo(0.2);
    expect(weights.get("FII2")).toBeCloseTo(0.2);
    expect(warning).toBe("2 ativo(s) sem % sugerida dividem igualmente o que falta para 100%.");
  });

  it("% que somam menos de 100% são reescaladas na mesma proporção, com aviso", () => {
    // 17 FIIs a 5%: a soma é 85%, e cada um passa a valer 1/17 da estratégia.
    const { weights, sumOfSuggested, warning } = effectiveWeights(items(...Array(17).fill(5)));
    expect(sumOfSuggested).toBe(85);
    for (const weight of weights.values()) expect(weight).toBeCloseTo(1 / 17);
    expect(warning).toBe(
      "As % sugeridas somam 85,0%. Foram ajustadas proporcionalmente para 100%.",
    );
  });

  it("% que passam de 100% também são reescaladas", () => {
    const { weights, warning } = effectiveWeights(items(60, 60));
    expect([...weights.values()]).toEqual([0.5, 0.5]);
    expect(warning).toBe(
      "As % sugeridas somam 120,0%. Foram ajustadas proporcionalmente para 100%.",
    );
  });
});

describe("suggestPercentFix", () => {
  it("não sugere nada quando a soma já é 100%", () => {
    expect(suggestPercentFix(items(50, 50))).toBeNull();
  });

  it("divide o que falta entre os FIIs sem %", () => {
    expect(suggestPercentFix(items(60, null, null))).toEqual([
      { ticker: "FII1", from: null, to: 20 },
      { ticker: "FII2", from: null, to: 20 },
    ]);
  });

  it("ajusta as % existentes na mesma proporção, com uma casa, fechando 100%", () => {
    const fixes = suggestPercentFix(items(...Array(17).fill(5)))!;
    const total = fixes.reduce((sum, fix) => sum + fix.to, 0);
    expect(total).toBeCloseTo(100, 9);
    expect(fixes.filter((fix) => fix.to === 5.9)).toHaveLength(14);
    expect(fixes.filter((fix) => fix.to === 5.8)).toHaveLength(3);
  });
});
