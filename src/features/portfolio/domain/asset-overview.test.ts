import { describe, expect, it } from "vitest";
import { dailyChange, yieldOnCost12m } from "./asset-overview";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const now = d("2026-11-07");

describe("yieldOnCost12m", () => {
  const position = { averagePrice: 100, quantity: 10 };

  it("soma os 12 meses de calendário antes do mês atual", () => {
    const paid = [
      { paidAt: d("2025-11-15"), amount: 10 }, // primeiro mês da janela
      { paidAt: d("2026-10-31"), amount: 10 }, // último mês da janela
      { paidAt: d("2026-11-05"), amount: 99 }, // mês atual: fora
      { paidAt: d("2025-10-31"), amount: 99 }, // antes da janela: fora
    ];
    expect(yieldOnCost12m(paid, position, now)).toBeCloseTo(20 / 1000);
  });

  it("é null sem posição ou sem custo", () => {
    const paid = [{ paidAt: d("2026-10-01"), amount: 10 }];
    expect(yieldOnCost12m(paid, { averagePrice: 100, quantity: 0 }, now)).toBeNull();
    expect(yieldOnCost12m(paid, { averagePrice: 0, quantity: 10 }, now)).toBeNull();
  });

  it("é zero com posição e sem proventos na janela", () => {
    expect(yieldOnCost12m([], position, now)).toBe(0);
  });
});

describe("dailyChange", () => {
  it("deriva o valor em R$ do preço e do percentual", () => {
    const result = dailyChange(110, 10);
    expect(result?.percent).toBe(10);
    expect(result?.amount).toBeCloseTo(10);
  });

  it("é null sem preço ou sem variação", () => {
    expect(dailyChange(null, 1)).toBeNull();
    expect(dailyChange(10, null)).toBeNull();
  });
});
