import { describe, expect, it } from "vitest";
import { detectScaleAnomaly, SCALE_ANOMALY_MIN_SAMPLES } from "./scale-anomaly";

const HISTORY = [1.45, 1.5, 1.52, 1.5, 1.48, 1.51];

describe("detectScaleAnomaly", () => {
  it("1500 com histórico de 1,50 é erro de escala", () => {
    const anomaly = detectScaleAnomaly(1500, HISTORY);
    expect(anomaly?.reference).toBeCloseTo(1.5, 2);
    expect(anomaly?.ratio).toBeGreaterThan(900);
  });

  it("0,015 (decimal deslocado para o outro lado) também é", () => {
    expect(detectScaleAnomaly(0.015, HISTORY)).not.toBeNull();
  });

  it("valor na escala, reajuste e provento extra de até 9 vezes não são", () => {
    expect(detectScaleAnomaly(1.5, HISTORY)).toBeNull();
    expect(detectScaleAnomaly(2.6, HISTORY)).toBeNull();
    expect(detectScaleAnomaly(13, HISTORY)).toBeNull();
  });

  it("o limite é exato: 10 vezes sinaliza, logo abaixo não", () => {
    expect(detectScaleAnomaly(15, [1.5, 1.5, 1.5])).not.toBeNull();
    expect(detectScaleAnomaly(14.99, [1.5, 1.5, 1.5])).toBeNull();
    expect(detectScaleAnomaly(0.15, [1.5, 1.5, 1.5])).not.toBeNull();
    expect(detectScaleAnomaly(0.16, [1.5, 1.5, 1.5])).toBeNull();
  });

  it("um valor muito fora no histórico não desloca a referência (mediana)", () => {
    expect(detectScaleAnomaly(1500, [1.5, 1.5, 1.5, 1.5, 1500])?.reference).toBe(1.5);
    expect(detectScaleAnomaly(1.5, [1.5, 1.5, 1.5, 1.5, 1500])).toBeNull();
  });

  it("sem histórico suficiente não opina", () => {
    expect(detectScaleAnomaly(1500, [])).toBeNull();
    expect(detectScaleAnomaly(1500, [1.5, 1.5].slice(0, SCALE_ANOMALY_MIN_SAMPLES - 1))).toBeNull();
  });

  it("entradas inválidas: nulo, zero, negativo, NaN e Infinity no valor ou no histórico", () => {
    expect(detectScaleAnomaly(Number.NaN, HISTORY)).toBeNull();
    expect(detectScaleAnomaly(Number.POSITIVE_INFINITY, HISTORY)).toBeNull();
    expect(detectScaleAnomaly(0, HISTORY)).toBeNull();
    expect(detectScaleAnomaly(-1500, HISTORY)).toBeNull();
    const dirty = [1.5, Number.NaN, 0, -3, Number.POSITIVE_INFINITY];
    expect(detectScaleAnomaly(1500, dirty)).toBeNull();
    expect(detectScaleAnomaly(1500, [...dirty, 1.5, 1.5])?.reference).toBe(1.5);
  });
});
