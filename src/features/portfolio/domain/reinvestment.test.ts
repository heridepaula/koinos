import { describe, expect, it } from "vitest";
import { shareReinvestment, splitAporte } from "./reinvestment";
import type { ReinvestmentMonth } from "./types";

const total = (aporte: number, dividends: number, percent = 100): ReinvestmentMonth => ({
  month: "2026-10",
  aporte,
  purchaseCount: 3,
  dividends,
  percent,
  isDefault: false,
  ...splitAporte(aporte, dividends, percent),
});

describe("shareReinvestment: rateio por classe", () => {
  it("FIIs + Ações somam o total", () => {
    const month = total(1000, 600);
    const fiis = shareReinvestment(month, { aporte: 700, purchaseCount: 2 });
    const stocks = shareReinvestment(month, { aporte: 300, purchaseCount: 1 });
    expect(fiis.aporte + stocks.aporte).toBeCloseTo(month.aporte, 6);
    expect(fiis.fromDividends + stocks.fromDividends).toBeCloseTo(month.fromDividends, 6);
    expect(fiis.fromPocket + stocks.fromPocket).toBeCloseTo(month.fromPocket, 6);
    expect(fiis.fromDividends).toBeCloseTo(420, 6);
  });

  it("classe sem compra no mês fica zerada", () => {
    const share = shareReinvestment(total(1000, 600), { aporte: 0, purchaseCount: 0 });
    expect(share.fromDividends).toBe(0);
    expect(share.fromPocket).toBe(0);
    expect(share.dividendsShare).toBeNull();
  });

  it("mês sem compra nenhuma fica zerado", () => {
    const share = shareReinvestment(total(0, 600), { aporte: 0, purchaseCount: 0 });
    expect(share.fromDividends).toBe(0);
  });

  it("o não gasto é da carteira: na classe, zero", () => {
    expect(shareReinvestment(total(100, 600), { aporte: 100, purchaseCount: 1 }).unspent).toBe(0);
  });
});
