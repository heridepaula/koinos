import { describe, expect, it } from "vitest";
import { aportePriorities, sunoCascade, type CascadeAsset } from "./suno-cascade";

/** FII de teste. Sem teto informado, o teto fica 5% acima do preço: margem de 4,8%, multiplicador 1. */
function fii(ticker: string, overrides: Partial<CascadeAsset> = {}): CascadeAsset {
  const price = overrides.price === undefined ? 10 : overrides.price;
  return {
    ticker,
    rank: 1,
    ceiling: price === null ? 100 : price * 1.05,
    weight: 0.5,
    price,
    quantity: 0,
    averagePrice: null,
    priceToBook: null,
    ...overrides,
  };
}

const order = (result: ReturnType<typeof sunoCascade>, ticker: string) =>
  result.orders.find((item) => item.ticker === ticker);
const reasonOf = (result: ReturnType<typeof sunoCascade>, ticker: string) =>
  result.excluded.find((item) => item.ticker === ticker)?.reason;

describe("sunoCascade: cascata pelo ranking", () => {
  it("o 1º do ranking leva o que pede antes do 2º", () => {
    const assets = [
      fii("AAAA11", { rank: 1, weight: 0.25 }),
      fii("BBBB11", { rank: 2, weight: 0.25 }),
      fii("CCCC11", { rank: 3, weight: 0.5, quantity: 100 }),
    ];
    // Metas sobre 1.000 + 300: AAAA11 e BBBB11 pedem 33 cotas cada; o saldo paga 30.
    const result = sunoCascade(300, assets, { maxSharePercent: 100 });
    expect(result.orders.map((item) => [item.ticker, item.quantity])).toEqual([["AAAA11", 30]]);
    expect(reasonOf(result, "BBBB11")).toBe("SEM_SALDO");
    expect(reasonOf(result, "CCCC11")).toBe("NA_META");
    expect(result.leftover).toBe(0);
  });

  it("o troco desce para um FII mais barato no fim da fila", () => {
    const assets = [fii("AAAA11", { rank: 1, price: 100 }), fii("BBBB11", { rank: 2, price: 10 })];
    const result = sunoCascade(150, assets, { maxSharePercent: 100 });
    expect(order(result, "AAAA11")?.quantity).toBe(1);
    expect(order(result, "BBBB11")?.quantity).toBe(5);
    expect(result.leftover).toBe(0);
  });
});

describe("sunoCascade: Índice de Convicção", () => {
  it("margem acima de 5% pede 1,2 vez o que falta, e o FII pode passar da meta", () => {
    const assets = [
      fii("AAAA11", { rank: 1, ceiling: 12.5, quantity: 50 }),
      fii("BBBB11", { rank: 2, ceiling: 10.4, quantity: 100 }),
    ];
    // Metas de 1.250 sobre 1.500 + 1.000: AAAA11 tem 500 e pede 750 × 1,2.
    const result = sunoCascade(1000, assets, { maxSharePercent: 100 });
    const discounted = order(result, "AAAA11")!;
    expect(discounted.marginMultiplier).toBe(1.2);
    expect(discounted.adjustedGap).toBe(900);
    expect(discounted.desired).toBe(90);
    expect(discounted.quantity).toBe(90);
    expect(discounted.gapAfter).toBe(-150);
    // Com 3,8% de margem, o BBBB11 pede só o que falta (25 cotas), mas o saldo paga 10.
    expect(order(result, "BBBB11")).toMatchObject({
      marginMultiplier: 1,
      desired: 25,
      quantity: 10,
    });
  });

  it("o P/VP acelera abaixo de 0,95, corta acima de 1,00 e se multiplica com a margem", () => {
    const assets = [
      fii("AAAA11", { rank: 1, weight: 1 / 3, ceiling: 12.5, priceToBook: 0.9 }),
      fii("BBBB11", { rank: 2, weight: 1 / 3, priceToBook: 1.05 }),
      fii("CCCC11", { rank: 3, weight: 1 / 3, ceiling: 12.5, priceToBook: 1.05 }),
    ];
    // Cada um tem meta de 100 e nada em carteira.
    const result = sunoCascade(300, assets, { maxSharePercent: 100 });
    expect(order(result, "AAAA11")).toMatchObject({
      marginMultiplier: 1.2,
      priceToBookMultiplier: 1.2,
      desired: 14,
    });
    expect(order(result, "BBBB11")).toMatchObject({ priceToBookMultiplier: 0.5, desired: 5 });
    expect(order(result, "CCCC11")).toMatchObject({ desired: 6 });
  });

  it("quem já está na meta não pede nada, mesmo descontado", () => {
    const assets = [
      fii("AAAA11", { rank: 1, quantity: 100, ceiling: 12.5, priceToBook: 0.8 }),
      fii("BBBB11", { rank: 2 }),
    ];
    const result = sunoCascade(100, assets, { maxSharePercent: 100 });
    expect(order(result, "AAAA11")).toBeUndefined();
    expect(reasonOf(result, "AAAA11")).toBe("NA_META");
  });
});

describe("sunoCascade: dinheiro sobrando", () => {
  it("fica guardado quando um FII ainda pede cotas que o saldo não paga", () => {
    const assets = [
      fii("AAAA11", { rank: 1, price: 100 }),
      fii("BBBB11", { rank: 2, price: 10, quantity: 30 }),
    ];
    // AAAA11 pede 3 cotas de 100 e o saldo paga 2. Os 50 que sobram não vão para o BBBB11.
    const result = sunoCascade(250, assets, { maxSharePercent: 100 });
    expect(order(result, "AAAA11")).toMatchObject({ quantity: 2, fromLeftover: 0, limited: false });
    expect(order(result, "BBBB11")).toBeUndefined();
    expect(result.leftover).toBe(50);
  });

  it("vai uma cota por vez para o menos representado quando todos compraram o que pediram", () => {
    const assets = [
      fii("AAAA11", { rank: 1, weight: 1 / 3, ceiling: 12.5, priceToBook: 0.9 }),
      fii("BBBB11", { rank: 2, weight: 1 / 3, priceToBook: 1.05 }),
      fii("CCCC11", { rank: 3, weight: 1 / 3, ceiling: 12.5, priceToBook: 1.05 }),
    ];
    // O passo 1 gasta 140 + 50 + 60 e sobram 50. A sobra alterna entre BBBB11 e CCCC11, os mais
    // abaixo da meta; no empate, o melhor ranking. O AAAA11, já acima da meta, não recebe.
    const result = sunoCascade(300, assets, { maxSharePercent: 100 });
    expect(order(result, "AAAA11")).toMatchObject({ quantity: 14, fromLeftover: 0 });
    expect(order(result, "BBBB11")).toMatchObject({ quantity: 8, fromLeftover: 3 });
    expect(order(result, "CCCC11")).toMatchObject({ quantity: 8, fromLeftover: 2 });
    expect(result.leftover).toBe(0);
  });

  it("no empate da sobra, vence o mais abaixo do preço médio", () => {
    const assets = [
      fii("AAAA11", { rank: 1, weight: 1 / 3, quantity: 100, averagePrice: 10 }),
      fii("BBBB11", { rank: 2, weight: 1 / 3, quantity: 100, averagePrice: 12 }),
      fii("CCCC11", { rank: 3, weight: 1 / 3, quantity: 100 }),
    ];
    // Com 12 de aporte, ninguém pede cota (falta menos de meia), e a sobra paga uma só.
    const result = sunoCascade(12, assets);
    expect(result.orders.map((item) => [item.ticker, item.fromLeftover])).toEqual([["BBBB11", 1]]);
    expect(result.leftover).toBe(2);
  });

  it("respeita o limite por ativo e para quando nenhuma cota cabe", () => {
    // Um só FII elegível, com limite de 50%: a outra metade fica guardada.
    const result = sunoCascade(100, [fii("AAAA11", { weight: 1 })], { maxSharePercent: 50 });
    expect(order(result, "AAAA11")).toMatchObject({ quantity: 5, total: 50, limited: true });
    expect(result.leftover).toBe(50);
  });
});

describe("sunoCascade: limite por ativo", () => {
  it("por padrão, nenhum FII leva mais de 33% do aporte", () => {
    // Pede 30 cotas de 10, mas o limite é 99 (33% de 300): compra 9, e o resto fica guardado.
    const result = sunoCascade(300, [fii("AAAA11", { weight: 1 })]);
    expect(result.maxSharePercent).toBe(33);
    expect(order(result, "AAAA11")).toMatchObject({ quantity: 9, total: 90, limited: true });
    expect(result.leftover).toBe(210);
  });

  it("passa do limite só quando uma cota já custa mais que ele", () => {
    const result = sunoCascade(100, [fii("AAAA11", { weight: 1, price: 90 })], {
      maxSharePercent: 25,
    });
    expect(order(result, "AAAA11")?.quantity).toBe(1);
  });

  it("sem limite, o multiplicador 0,6 não impede um FII novo de levar o aporte inteiro", () => {
    const assets = [
      // Novo, 1º do ranking, margem de 9,1% (×1,2) e P/VP 1,05 (×0,5): pede 0,6 × 25.000.
      fii("NOVO11", { rank: 1, price: 100, ceiling: 110, priceToBook: 1.05 }),
      fii("VELH11", { rank: 2, price: 100, quantity: 400 }),
    ];
    const unlimited = sunoCascade(10_000, assets, { maxSharePercent: 100 });
    expect(order(unlimited, "NOVO11")).toMatchObject({ adjustedGap: 15_000, total: 10_000 });
    const capped = sunoCascade(10_000, assets, { maxSharePercent: 50 });
    expect(order(capped, "NOVO11")?.total).toBe(5_000);
  });
});

describe("sunoCascade: invariantes", () => {
  // Gerador determinístico (LCG): os mesmos 500 casos a cada execução.
  function random(seed: number) {
    let state = seed;
    return () => {
      state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
      return state / 4_294_967_296;
    };
  }

  it("não gasta mais que o aporte, respeita o limite e só redistribui sem ninguém pedindo cota", () => {
    const next = random(42);
    for (let run = 0; run < 500; run++) {
      const count = 1 + Math.floor(next() * 8);
      const assets = Array.from({ length: count }, (_, index) => {
        const price = Math.round((5 + next() * 150) * 100) / 100;
        return fii(`F${String.fromCharCode(65 + index)}XX11`, {
          rank: next() < 0.1 ? null : 1 + Math.floor(next() * 20),
          price,
          ceiling: price * (0.9 + next() * 0.4),
          weight: 1 / count,
          quantity: Math.floor(next() * 400),
          averagePrice: next() < 0.5 ? price * (0.8 + next() * 0.4) : null,
          priceToBook: next() < 0.5 ? 0.8 + next() * 0.4 : null,
        });
      });
      const amount = Math.round(next() * 20_000 * 100) / 100;
      const maxSharePercent = [25, 33, 50, 75, 100][Math.floor(next() * 5)];
      const result = sunoCascade(amount, assets, { maxSharePercent });

      expect(result.leftover).toBeGreaterThanOrEqual(0);
      expect(Math.abs(result.spent + result.leftover - result.amount)).toBeLessThan(0.005);
      const limit = maxSharePercent >= 100 ? Infinity : (maxSharePercent / 100) * result.amount;
      for (const item of result.orders) {
        const asset = assets.find((candidate) => candidate.ticker === item.ticker)!;
        expect(asset.rank).not.toBeNull();
        expect(asset.price!).toBeLessThan(asset.ceiling!);
        expect(item.total).toBeLessThanOrEqual(Math.max(limit, item.price) + 1e-6);
      }
      if (result.orders.some((item) => item.fromLeftover > 0)) {
        expect(result.excluded.some((item) => item.reason === "SEM_SALDO")).toBe(false);
      }
    }
  });
});

describe("aportePriorities", () => {
  it("a fila segue o ranking entre quem pede cotas; os outros mostram o motivo", () => {
    const assets = [
      fii("AAAA11", { rank: 2, weight: 0.3, quantity: 10 }),
      fii("BBBB11", { rank: 1, weight: 0.3, quantity: 10 }),
      fii("CCCC11", { rank: 3, weight: 0.4, quantity: 30 }),
      fii("DDDD11", { rank: 4, weight: 0, ceiling: 9 }),
      fii("EEEE11", { rank: null, weight: 0 }),
    ];
    const priorities = aportePriorities(assets);
    expect(priorities.get("BBBB11")).toEqual({ kind: "fila", position: 1 });
    expect(priorities.get("AAAA11")).toEqual({ kind: "fila", position: 2 });
    expect(priorities.get("CCCC11")).toEqual({ kind: "fora", reason: "NA_META" });
    expect(priorities.get("DDDD11")).toEqual({ kind: "fora", reason: "ACIMA_DO_TETO" });
    expect(priorities.get("EEEE11")).toEqual({ kind: "fora", reason: "SEM_RANKING" });
  });
});
