import { describe, expect, it } from "vitest";
import { round2 } from "@/shared/lib/money";
import { replayLedger } from "@/features/transactions";
import { yieldOnCost12m } from "./asset-overview";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const entry = (
  id: string,
  type: "BUY" | "SELL",
  date: string,
  quantity: number,
  unitPrice: number,
  kind?: "DESDOBRO",
) => ({
  id,
  ticker: "ABCD3",
  type,
  quantity,
  unitPrice,
  fees: 0,
  date: day(date),
  createdAt: day(date),
  kind,
});

describe("yield on cost com desdobro 1:10", () => {
  const before = [entry("1", "BUY", "2025-03-10", 100, 50)];
  const after = [...before, entry("2", "BUY", "2026-02-02", 900, 0, "DESDOBRO")];
  const dividends = [
    { paidAt: day("2025-12-15"), amount: 120 },
    { paidAt: day("2026-06-15"), amount: 130 },
  ];
  const now = new Date("2026-11-10T15:00:00Z");

  it("a posição ganha cotas e perde preço médio, e o custo continua o mesmo", () => {
    const a = replayLedger(before).positions[0]!;
    const b = replayLedger(after).positions[0]!;
    expect(b.quantity).toBe(a.quantity * 10);
    expect(b.averagePrice).toBeCloseTo(a.averagePrice / 10, 10);
    expect(b.totalCost).toBeCloseTo(a.totalCost, 10);
  });

  it("o yield on cost não muda com o desdobro (os proventos são em R$, não por cota)", () => {
    const a = replayLedger(before).positions[0]!;
    const b = replayLedger(after).positions[0]!;
    const yieldBefore = yieldOnCost12m(dividends, a, now)!;
    const yieldAfter = yieldOnCost12m(dividends, b, now)!;
    expect(yieldBefore).toBeCloseTo(250 / 5000, 10);
    expect(yieldAfter).toBeCloseTo(yieldBefore, 10);
  });

  it("sem posição ou sem custo, o yield on cost é null e não divide por zero", () => {
    expect(yieldOnCost12m(dividends, { averagePrice: 0, quantity: 100 }, now)).toBeNull();
    expect(yieldOnCost12m(dividends, { averagePrice: 5, quantity: 0 }, now)).toBeNull();
  });
});

/**
 * O provento a receber é cotas × valor por cota (JCP líquido a 85%). O JS faz isso em ponto
 * flutuante; a B3 credita em centavos. Aqui o resultado em `number` com `round2` é comparado a uma
 * conta exata em inteiros, com valores por cota de até 4 casas, para saber se o erro de
 * ponto flutuante chega a mudar um centavo. Se mudasse, o cálculo teria de ir para inteiros.
 */
describe("provento em centavos: ponto flutuante contra inteiros", () => {
  const seeded = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const compare = (jcp: boolean) => {
    const random = seeded(jcp ? 7 : 11);
    let ties = 0;
    const mismatches: string[] = [];
    for (let i = 0; i < 20_000; i++) {
      const quantity = 1 + Math.floor(random() * 20_000);
      const perShare4 = 1 + Math.floor(random() * 30_000); // 0,0001 a 3,0000
      const gross = perShare4 / 10_000;
      const perShare = jcp ? gross * 0.85 : gross;
      const float = round2(quantity * perShare);

      // Em centavos, só com inteiros (no máximo 6e10, exatos em Number): cotas × valor por cota
      // (em 1/10.000) × (100 ou 85) ÷ 10.000, com meio centavo subindo.
      const numerator = quantity * perShare4 * (jcp ? 85 : 100);
      const denominator = 10_000;
      const exact = Math.floor((numerator * 2 + denominator) / (denominator * 2)) / 100;
      const remainder = (numerator * 2) % (denominator * 2);
      if (remainder === denominator) ties++;
      else if (float !== exact)
        mismatches.push(`${quantity} × ${perShare4}/1e4 → ${float} ≠ ${exact}`);
    }
    return { ties, mismatches };
  };

  it("rendimento e dividendo: cotas × valor por cota fecha no mesmo centavo", () => {
    expect(compare(false).mismatches).toEqual([]);
  });

  it("JCP líquido (×0,85): fecha no mesmo centavo", () => {
    expect(compare(true).mismatches).toEqual([]);
  });

  it("a soma de muitos proventos não desvia um centavo da soma em inteiros", () => {
    const random = seeded(3);
    let float = 0;
    let cents = 0;
    for (let i = 0; i < 5_000; i++) {
      const amount = round2(1 + random() * 500);
      float += amount;
      cents += Math.round(amount * 100);
    }
    expect(round2(float)).toBe(cents / 100);
  });
});
