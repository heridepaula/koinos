import { describe, expect, it } from "vitest";
import { ENGINE_VERSIONS } from "./engine-options";
import { stockPriorities, stockSmartBuy, type StockBuyAsset } from "./stock-buy";

const TABLE: StockBuyAsset[] = [
  {
    ticker: "BBSE3",
    rank: 1,
    price: 41.25,
    ceiling: 35.5,
    weight: 0.1,
    bias: "AGUARDAR",
    quantity: 0,
  },
  {
    ticker: "BBAS3",
    rank: 2,
    price: 16.48,
    ceiling: 25,
    weight: 0.1,
    bias: "COMPRAR",
    quantity: 0,
  },
  {
    ticker: "UNIP6",
    rank: 3,
    price: 51,
    ceiling: 70,
    weight: 0.1,
    bias: "COMPRAR",
    quantity: 0,
  },
  {
    ticker: "SEER3",
    rank: 4,
    price: 10.71,
    ceiling: 14,
    weight: 0.075,
    bias: "COMPRAR",
    quantity: 0,
  },
  {
    ticker: "VALE3",
    rank: 5,
    price: 62.01,
    ceiling: 78,
    weight: 0.1,
    bias: "COMPRAR",
    quantity: 0,
  },
  {
    ticker: "SLCE3",
    rank: 6,
    price: 16.94,
    ceiling: 20.4,
    weight: 0.075,
    bias: "COMPRAR",
    quantity: 0,
  },
  {
    ticker: "PETR4",
    rank: 7,
    price: 52.93,
    ceiling: 38,
    weight: 0.075,
    bias: "AGUARDAR",
    quantity: 0,
  },
  {
    ticker: "AXIA7",
    rank: 8,
    price: 47.9,
    ceiling: 42.4,
    weight: 0.05,
    bias: "AGUARDAR",
    quantity: 0,
  },
  {
    ticker: "TUPY3",
    rank: 9,
    price: 14.5,
    ceiling: 21,
    weight: 0.04,
    bias: "COMPRAR",
    quantity: 0,
  },
  {
    ticker: "AGRO3",
    rank: 10,
    price: 17.31,
    ceiling: 27.5,
    weight: 0.025,
    bias: "COMPRAR",
    quantity: 0,
  },
  {
    ticker: "EGIE3",
    rank: 11,
    price: 26.26,
    ceiling: 28.6,
    weight: 0.025,
    bias: "COMPRAR",
    quantity: 0,
  },
  {
    ticker: "ITSA4",
    rank: 12,
    price: 12.46,
    ceiling: 11.5,
    weight: 0.05,
    bias: "AGUARDAR",
    quantity: 0,
  },
];

function asset(patch: Partial<StockBuyAsset> = {}): StockBuyAsset {
  return {
    ticker: "TEST3",
    rank: 1,
    ceiling: 20,
    price: 10,
    quantity: 0,
    weight: 0.1,
    bias: null,
    ...patch,
  };
}

describe("stockSmartBuy: tabela do documento", () => {
  const result = stockSmartBuy(5000, TABLE);

  it("ordena as ordens pela margem de segurança", () => {
    expect(result.orders.map((o) => o.ticker)).toEqual([
      "AGRO3",
      "BBAS3",
      "TUPY3",
      "UNIP6",
      "SEER3",
      "VALE3",
      "SLCE3",
      "EGIE3",
    ]);
    const margins = result.orders.map((o) => Math.round(o.marginOfSafety * 1000) / 10);
    expect(margins).toEqual([58.9, 51.7, 44.8, 37.3, 30.7, 25.8, 20.4, 8.9]);
  });

  it("UNIP6 vem antes de VALE3, com 9 e 8 ações", () => {
    const tickers = result.orders.map((o) => o.ticker);
    expect(tickers.indexOf("UNIP6")).toBeLessThan(tickers.indexOf("VALE3"));
    const unip = result.orders.find((o) => o.ticker === "UNIP6")!;
    const vale = result.orders.find((o) => o.ticker === "VALE3")!;
    expect(unip.quantity).toBe(9);
    expect(unip.total).toBe(459);
    expect(vale.quantity).toBe(8);
    expect(vale.total).toBe(496.08);
  });

  it("deixa de fora as quatro acima do teto", () => {
    const reasons = Object.fromEntries(result.excluded.map((e) => [e.ticker, e.reason]));
    expect(reasons).toEqual({
      BBSE3: "ACIMA_DO_TETO",
      PETR4: "ACIMA_DO_TETO",
      AXIA7: "ACIMA_DO_TETO",
      ITSA4: "ACIMA_DO_TETO",
    });
  });

  it("gasto + sobra = aporte", () => {
    expect(Math.round((result.spent + result.leftover) * 100) / 100).toBe(5000);
  });

  it("viés Aguardar com preço abaixo do teto fica de fora como AGUARDAR", () => {
    const r = stockSmartBuy(5000, [asset({ bias: "AGUARDAR" })]);
    expect(r.orders).toEqual([]);
    expect(r.excluded).toEqual([{ ticker: "TEST3", rank: 1, reason: "AGUARDAR" }]);
  });
});

describe("stockSmartBuy: regras", () => {
  it("viés null não bloqueia", () => {
    const r = stockSmartBuy(1000, [asset({ bias: null })]);
    expect(r.orders).toHaveLength(1);
  });

  it("empate de margem: menor rank primeiro", () => {
    const r = stockSmartBuy(1000, [
      asset({ ticker: "BBB3", rank: 2 }),
      asset({ ticker: "AAA3", rank: 1 }),
    ]);
    expect(r.orders.map((o) => o.ticker)).toEqual(["AAA3", "BBB3"]);
  });

  it("nenhuma ordem passa do déficit", () => {
    const r = stockSmartBuy(1005, [asset({ weight: 0.5 })]);
    const order = r.orders[0];
    expect(order.total).toBeLessThanOrEqual(order.deficitBefore);
    expect(order.quantity).toBe(50);
  });

  it("PEDIDO_PEQUENO quando o déficit não paga uma ação", () => {
    const r = stockSmartBuy(100, [asset({ price: 15, weight: 0.1 })]);
    expect(r.excluded).toEqual([{ ticker: "TEST3", rank: 1, reason: "PEDIDO_PEQUENO" }]);
  });

  it("SEM_SALDO quando o aporte já acabou para o próximo da fila", () => {
    const r = stockSmartBuy(100, [
      asset({ ticker: "AAA3", rank: 1, price: 10, ceiling: 40, weight: 1 }),
      asset({ ticker: "BBB3", rank: 2, price: 10, ceiling: 20, weight: 1 }),
    ]);
    expect(r.orders.map((o) => o.ticker)).toEqual(["AAA3"]);
    expect(r.excluded).toEqual([{ ticker: "BBB3", rank: 2, reason: "SEM_SALDO" }]);
    expect(r.leftover).toBe(0);
  });

  it("NA_META, SEM_COTACAO e SEM_TETO", () => {
    const r = stockSmartBuy(1000, [
      asset({ ticker: "A3", quantity: 1000 }),
      asset({ ticker: "B3", price: null }),
      asset({ ticker: "C3", ceiling: null }),
    ]);
    const reasons = Object.fromEntries(r.excluded.map((e) => [e.ticker, e.reason]));
    expect(reasons).toEqual({ A3: "NA_META", B3: "SEM_COTACAO", C3: "SEM_TETO" });
  });

  it("a meta é a base vezes o peso, e a ordem leva o peso recebido", () => {
    // Base: R$ 100 na carteira + R$ 1.000 do aporte; meta de 25% = R$ 275.
    const r = stockSmartBuy(1000, [asset({ quantity: 10, weight: 0.25 })]);
    expect(r.orders[0]).toMatchObject({ targetValue: 275, targetWeight: 0.25, quantity: 17 });
  });
});

describe("stockPriorities", () => {
  // Com aporte zero, a meta vem só do que já está na carteira: aqui, as quatro que passaram do teto.
  const ABOVE_CEILING = ["BBSE3", "PETR4", "AXIA7", "ITSA4"];
  const held = TABLE.map((item) =>
    ABOVE_CEILING.includes(item.ticker) ? { ...item, quantity: 100 } : item,
  );

  it("tabela do documento: a fila segue a margem de segurança, como as ordens", () => {
    const priorities = stockPriorities(held);
    const queue = ["AGRO3", "BBAS3", "TUPY3", "UNIP6", "SEER3", "VALE3", "SLCE3", "EGIE3"];
    queue.forEach((ticker, index) =>
      expect(priorities.get(ticker)).toEqual({ kind: "fila", position: index + 1 }),
    );
    expect(priorities.size).toBe(TABLE.length);
  });

  it("tabela do documento: as quatro acima do teto ficam de fora, mesmo com Aguardar", () => {
    const priorities = stockPriorities(held);
    for (const ticker of ABOVE_CEILING) {
      expect(priorities.get(ticker)).toEqual({ kind: "fora", reason: "ACIMA_DO_TETO" });
    }
  });

  it("viés Aguardar abaixo do teto fica de fora como AGUARDAR", () => {
    // Pela margem (100%), seria a 1ª da fila.
    const priorities = stockPriorities([...held, asset({ ticker: "WAIT3", bias: "AGUARDAR" })]);
    expect(priorities.get("WAIT3")).toEqual({ kind: "fora", reason: "AGUARDAR" });
    expect(priorities.get("AGRO3")).toEqual({ kind: "fila", position: 1 });
  });

  it("empate de margem: menor rank, depois o ticker", () => {
    const priorities = stockPriorities([
      // Acima do teto: só dá a base (R$ 3.000) para as metas das outras.
      asset({ ticker: "ZZZ3", price: 30, ceiling: 20, quantity: 100 }),
      asset({ ticker: "BBB3", rank: 2 }),
      asset({ ticker: "AAA3", rank: 2 }),
      asset({ ticker: "CCC3", rank: 1 }),
    ]);
    expect(priorities.get("CCC3")).toEqual({ kind: "fila", position: 1 });
    expect(priorities.get("AAA3")).toEqual({ kind: "fila", position: 2 });
    expect(priorities.get("BBB3")).toEqual({ kind: "fila", position: 3 });
  });

  it("NA_META, PEDIDO_PEQUENO, SEM_COTACAO e SEM_TETO", () => {
    // Base: os R$ 10.000 do A3. A meta do P3 (0,1% = R$ 10) não paga uma ação de R$ 15.
    const priorities = stockPriorities([
      asset({ ticker: "A3", quantity: 1000 }),
      asset({ ticker: "P3", price: 15, weight: 0.001 }),
      asset({ ticker: "B3", price: null }),
      asset({ ticker: "C3", ceiling: null }),
    ]);
    expect(Object.fromEntries(priorities)).toEqual({
      A3: { kind: "fora", reason: "NA_META" },
      P3: { kind: "fora", reason: "PEDIDO_PEQUENO" },
      B3: { kind: "fora", reason: "SEM_COTACAO" },
      C3: { kind: "fora", reason: "SEM_TETO" },
    });
  });
});

function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

// As 300 carteiras da semente 7, as mesmas para os testes de invariantes e de lote.
function portfolios() {
  const next = random(7);
  return Array.from({ length: 300 }, () => {
    const count = 1 + Math.floor(next() * 12);
    const assets: StockBuyAsset[] = Array.from({ length: count }, (_, i) => {
      const price = 5 + next() * 95;
      const roll = next();
      return {
        ticker: `T${i}`,
        rank: next() < 0.1 ? null : 1 + Math.floor(next() * 12),
        price: roll < 0.05 ? null : price,
        ceiling: roll > 0.95 ? null : price * (0.7 + next() * 0.8),
        quantity: Math.floor(next() * 100),
        weight: next() < 0.1 ? 0 : Math.round(next() * 20 * 10) / 1000,
        bias: next() < 0.2 ? "AGUARDAR" : next() < 0.5 ? "COMPRAR" : null,
      };
    });
    const amount = Math.round(next() * 20_000 * 100) / 100;
    return { amount, assets };
  });
}

describe("stockSmartBuy: invariantes", () => {
  it("com as opções da 3.0, o resultado é o mesmo que sem opções", () => {
    for (const { amount, assets } of portfolios()) {
      expect(stockSmartBuy(amount, assets, ENGINE_VERSIONS["3.0"])).toEqual(
        stockSmartBuy(amount, assets),
      );
      expect(stockPriorities(assets, ENGINE_VERSIONS["3.0"])).toEqual(stockPriorities(assets));
    }
  });

  it("300 carteiras aleatórias", () => {
    for (const { amount, assets } of portfolios()) {
      const count = assets.length;
      const r = stockSmartBuy(amount, assets);

      expect(r.spent + r.leftover).toBeCloseTo(amount, 2);
      expect(r.leftover).toBeGreaterThanOrEqual(0);
      expect(r.spent).toBeLessThanOrEqual(amount + 1e-6);
      expect(r.orders.length + r.excluded.length).toBe(count);

      const byTicker = new Map(assets.map((a) => [a.ticker, a]));
      let previousMargin = Infinity;
      for (const order of r.orders) {
        const a = byTicker.get(order.ticker)!;
        expect(a.bias).not.toBe("AGUARDAR");
        expect(a.price!).toBeLessThanOrEqual(a.ceiling! + 1e-9);
        expect(order.quantity).toBeGreaterThan(0);
        expect(Number.isInteger(order.quantity)).toBe(true);
        expect(order.total).toBeLessThanOrEqual(order.deficitBefore + 0.01);
        expect(order.marginOfSafety).toBeLessThanOrEqual(previousMargin + 1e-12);
        previousMargin = order.marginOfSafety;
      }
    }
  });
});

describe("stockSmartBuy: lote e sobra", () => {
  const V31 = ENGINE_VERSIONS["3.1"];
  const ABOVE_CEILING = ["BBSE3", "PETR4", "AXIA7", "ITSA4"];
  const cents = (value: number) => Math.round(value * 100);

  /** As ações que podem receber na sobra: com cotação e teto, até o teto, sem Aguardar e com peso. */
  const leftoverPool = (assets: readonly StockBuyAsset[]) =>
    assets.filter(
      (a) =>
        a.price !== null &&
        a.price > 0 &&
        a.ceiling !== null &&
        a.price <= a.ceiling + 1e-9 &&
        a.bias !== "AGUARDAR" &&
        a.weight > 0,
    );

  it("todas as ordens são múltiplas de 100", () => {
    const table = stockSmartBuy(50_000, TABLE, V31);
    expect(table.orders.length).toBeGreaterThan(0);
    for (const { orders } of [
      table,
      ...portfolios().map((p) => stockSmartBuy(p.amount, p.assets, V31)),
    ]) {
      for (const order of orders) {
        expect(order.quantity % 100).toBe(0);
        expect(order.fromLeftover % 100).toBe(0);
        expect(order.lot).toBe(100);
      }
    }
  });

  it("déficit de meio lote: MENOS_DE_UM_LOTE", () => {
    // Base R$ 10.000: a meta do B3 (20% = R$ 2.000) é meio lote de R$ 4.000, que também não cabe na
    // sobra de R$ 3.000; com lote 1, entraria na fila.
    const assets = [
      asset({ ticker: "A3", price: 10, ceiling: 20, weight: 0.75 }),
      asset({ ticker: "B3", price: 40, ceiling: 60, weight: 0.2 }),
    ];
    const r = stockSmartBuy(10_000, assets, V31);
    expect(r.excluded).toEqual([{ ticker: "B3", rank: 1, reason: "MENOS_DE_UM_LOTE" }]);
    expect(r.orders.map((o) => [o.ticker, o.quantity, o.fromLeftover])).toEqual([
      ["A3", 1000, 300],
    ]);
    expect(stockSmartBuy(10_000, assets).orders.map((o) => o.ticker)).toEqual(["A3", "B3"]);
  });

  it("SEM_SALDO quando o déficit pede um lote e o caixa acabou", () => {
    const r = stockSmartBuy(
      1000,
      [
        asset({ ticker: "AAA3", rank: 1, price: 10, ceiling: 40, weight: 1 }),
        asset({ ticker: "BBB3", rank: 2, price: 10, ceiling: 20, weight: 1 }),
      ],
      V31,
    );
    expect(r.orders.map((o) => [o.ticker, o.quantity])).toEqual([["AAA3", 100]]);
    expect(r.excluded).toEqual([{ ticker: "BBB3", rank: 2, reason: "SEM_SALDO" }]);
    expect(r.leftover).toBe(0);
  });

  it("a sobra vai para a menor razão valor ÷ meta e pode passar da meta", () => {
    // Passo 1: A3 (margem 100%) compra 5 lotes (R$ 5.000 de R$ 5.500, 91%) e B3 (margem 50%), 4
    // lotes (R$ 4.000 de R$ 4.500, 89%). O lote da sobra vai para B3, que passa da meta.
    const r = stockSmartBuy(
      10_000,
      [
        asset({ ticker: "A3", price: 10, ceiling: 20, weight: 0.55 }),
        asset({ ticker: "B3", price: 10, ceiling: 15, weight: 0.45 }),
      ],
      V31,
    );
    expect(r.orders.map((o) => [o.ticker, o.quantity, o.fromLeftover])).toEqual([
      ["A3", 500, 0],
      ["B3", 500, 100],
    ]);
    const b3 = r.orders[1];
    expect(b3.targetValue).toBe(4500);
    expect(b3.total).toBe(5000);
    expect(b3.total).toBeGreaterThan(b3.targetValue);
    expect(r.leftover).toBe(0);
  });

  it("a ação que estava NA_META recebe na sobra se for a única que cabe", () => {
    // Base R$ 2.000: A3 já vale R$ 1.000 para uma meta de R$ 200; o lote do B3 (R$ 3.000) não cabe.
    const r = stockSmartBuy(
      1000,
      [
        asset({ ticker: "A3", quantity: 100, price: 10, ceiling: 20, weight: 0.1 }),
        asset({ ticker: "B3", price: 30, ceiling: 40, weight: 0.9 }),
      ],
      V31,
    );
    expect(r.orders).toHaveLength(1);
    expect(r.orders[0]).toMatchObject({
      ticker: "A3",
      quantity: 100,
      fromLeftover: 100,
      total: 1000,
      deficitBefore: -800,
      targetValue: 200,
      weightAfter: 1,
    });
    expect(r.excluded).toEqual([{ ticker: "B3", rank: 1, reason: "MENOS_DE_UM_LOTE" }]);
  });

  it("o caixa final é menor que o lote mais barato entre as elegíveis", () => {
    // Tabela do documento: o lote mais barato entre as elegíveis é o do SEER3 (R$ 1.071).
    const table = stockSmartBuy(50_000, TABLE, V31);
    expect(table.leftover).toBeGreaterThanOrEqual(0);
    expect(table.leftover).toBeLessThan(1071);

    for (const { amount, assets } of portfolios()) {
      const r = stockSmartBuy(amount, assets, V31);
      const pool = leftoverPool(assets);
      if (pool.length === 0) {
        expect(r.leftover).toBe(amount);
        continue;
      }
      const cheapest = Math.min(...pool.map((a) => 100 * a.price!));
      // Um centavo de folga: o caixa perde o custo do lote já arredondado.
      expect(r.leftover).toBeLessThan(cheapest + 0.01);
    }
  });

  it("nada é comprado acima do teto nem com Aguardar", () => {
    const r = stockSmartBuy(100_000, [...TABLE, asset({ ticker: "WAIT3", bias: "AGUARDAR" })], V31);
    const tickers = r.orders.map((o) => o.ticker);
    for (const ticker of [...ABOVE_CEILING, "WAIT3"]) expect(tickers).not.toContain(ticker);
    const reasons = Object.fromEntries(r.excluded.map((e) => [e.ticker, e.reason]));
    for (const ticker of ABOVE_CEILING) expect(reasons[ticker]).toBe("ACIMA_DO_TETO");
    expect(reasons.WAIT3).toBe("AGUARDAR");

    for (const { amount, assets } of portfolios()) {
      const byTicker = new Map(assets.map((a) => [a.ticker, a]));
      for (const order of stockSmartBuy(amount, assets, V31).orders) {
        const a = byTicker.get(order.ticker)!;
        expect(a.bias).not.toBe("AGUARDAR");
        expect(a.price!).toBeLessThanOrEqual(a.ceiling! + 1e-9);
      }
    }
  });

  it("300 carteiras aleatórias: gasto + sobra = aporte, em centavos", () => {
    for (const { amount, assets } of portfolios()) {
      const r = stockSmartBuy(amount, assets, V31);
      expect(cents(r.spent + r.leftover)).toBe(cents(amount));
      expect(cents(r.orders.reduce((sum, o) => sum + o.total, 0))).toBe(cents(r.spent));
      expect(r.leftover).toBeGreaterThanOrEqual(0);
      expect(r.orders.length + r.excluded.length).toBe(assets.length);
    }
  });

  it("fromLeftover conta as ações da sobra, e quem só recebeu nela vem no fim e sai de excluded", () => {
    // Passo 1: A3 e C3 compram 4 lotes; B3 (meta R$ 800) fica com menos de um lote. Sobra de
    // R$ 2.000: um lote para B3 (razão 0) e um para C3 (85%, abaixo dos 89% do A3).
    const r = stockSmartBuy(
      10_000,
      [
        asset({ ticker: "A3", price: 10, ceiling: 20, weight: 0.45 }),
        asset({ ticker: "B3", price: 10, ceiling: 12, weight: 0.08 }),
        asset({ ticker: "C3", price: 10, ceiling: 15, weight: 0.47 }),
      ],
      V31,
    );
    expect(r.orders.map((o) => [o.ticker, o.quantity, o.fromLeftover])).toEqual([
      ["A3", 400, 0],
      ["C3", 500, 100],
      ["B3", 100, 100],
    ]);
    expect(r.excluded).toEqual([]);
    expect(r.spent).toBe(10_000);
    expect(r.leftover).toBe(0);
  });

  it("stockPriorities com lote: na fila só quem pede ao menos um lote", () => {
    // Acima do teto: só dá a base (R$ 30.000) para as metas das outras. A meta do Q3 (R$ 1.500) não
    // chega a um lote de R$ 2.000.
    const assets = [
      asset({ ticker: "ZZZ3", price: 30, ceiling: 20, quantity: 1000 }),
      asset({ ticker: "P3", rank: 1, price: 10, ceiling: 20, weight: 0.05 }),
      asset({ ticker: "Q3", rank: 3, price: 20, ceiling: 30, weight: 0.05 }),
      asset({ ticker: "R3", rank: 2, price: 5, ceiling: 10, weight: 0.02 }),
    ];
    expect(Object.fromEntries(stockPriorities(assets, V31))).toEqual({
      ZZZ3: { kind: "fora", reason: "ACIMA_DO_TETO" },
      P3: { kind: "fila", position: 1 },
      Q3: { kind: "fora", reason: "MENOS_DE_UM_LOTE" },
      R3: { kind: "fila", position: 2 },
    });
    expect(stockPriorities(assets, ENGINE_VERSIONS["3.0"]).get("Q3")).toEqual({
      kind: "fila",
      position: 3,
    });
  });

  it("com a 3.0, a tabela do documento dá o mesmo de hoje: lote 1 e nada da sobra", () => {
    const r = stockSmartBuy(5000, TABLE, ENGINE_VERSIONS["3.0"]);
    expect(r).toEqual(stockSmartBuy(5000, TABLE));
    for (const order of r.orders) expect(order).toMatchObject({ lot: 1, fromLeftover: 0 });
    const quantities = Object.fromEntries(r.orders.map((o) => [o.ticker, o.quantity]));
    expect(quantities).toMatchObject({ UNIP6: 9, VALE3: 8 });
  });
});
