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

describe("stockSmartBuy: invariantes", () => {
  function random(seed: number) {
    let state = seed;
    return () => {
      state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
      return state / 4_294_967_296;
    };
  }

  // As 300 carteiras da semente 7, as mesmas para os testes deste bloco.
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
