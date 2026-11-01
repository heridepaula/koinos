import { describe, expect, it } from "vitest";
import { ENGINE_VERSIONS } from "./engine-options";
import { RISK_CAPS } from "./risk";
import {
  aportePriorities,
  isDividendSuspended,
  sunoCascade,
  type CascadeAsset,
} from "./suno-cascade";

/** FII de teste: R$ 100 a cota, teto R$ 110 (margem de 9,1%, tensor de segurança 1,0909), tijolo. */
function fii(ticker: string, overrides: Partial<CascadeAsset> = {}): CascadeAsset {
  return {
    ticker,
    rank: 1,
    ceiling: 110,
    weight: 0.5,
    price: 100,
    quantity: 0,
    averagePrice: null,
    priceToBook: null,
    lastDividend: null,
    dividends12m: null,
    vacancy: null,
    macro: "Tijolo",
    sector: null,
    ...overrides,
  };
}

/** FII acima do teto: fica fora da cascata, mas o valor dele conta na estratégia (infla as metas). */
const anchor = (value: number, weight: number) =>
  fii("ANCR11", { rank: 99, weight, quantity: value / 100, ceiling: 90, macro: "Outros" });

const order = (result: ReturnType<typeof sunoCascade>, ticker: string) =>
  result.orders.find((item) => item.ticker === ticker);
const reasonOf = (result: ReturnType<typeof sunoCascade>, ticker: string) =>
  result.excluded.find((item) => item.ticker === ticker)?.reason;

describe("sunoCascade: o pedido", () => {
  it("é o gap vezes os tensores, e o limite por FII corta o que passar de 25%", () => {
    const assets = [
      fii("AAAA11", {
        rank: 1,
        ceiling: 125, // margem de 20%: ×1,2
        priceToBook: 0.9, // ×1,1
        lastDividend: 0.5, // metade da média mensal (12 ÷ 12): ×0,5
        dividends12m: 12,
        vacancy: 0.1, // ×0,9
      }),
      fii("BBBB11", { rank: 2, quantity: 100 }),
    ];
    // Metas de 10.000 sobre 10.000 + 10.000: o AAAA11 pede 10.000 × 1,1 × 0,5 × 1,2 × 0,9.
    const result = sunoCascade(10_000, assets);
    const first = order(result, "AAAA11")!;
    expect(first.tensors.valuation).toBeCloseTo(1.1);
    expect(first.tensors.dividends).toBeCloseTo(0.5);
    expect(first.tensors.safety).toBeCloseTo(1.2);
    expect(first.tensors.vacancy).toBeCloseTo(0.9);
    expect(first.need).toBeCloseTo(5_940, 0);
    expect(first).toMatchObject({ quantity: 25, fromLeftover: 0, limitedBy: "ativo" });
  });
});

describe("sunoCascade: cenários do documento 3.0", () => {
  it("A, rotação: o 1º do ranking já na meta não recebe, e o aporte escorrega pela fila", () => {
    const assets = [
      fii("TOP111", { rank: 1, weight: 1 / 6, price: 10, ceiling: 10.5, quantity: 165 }),
      ...["TOP211", "TOP311", "TOP411"].map((ticker, index) =>
        fii(ticker, { rank: index + 2, weight: 1 / 6, price: 10, ceiling: 10.5, quantity: 100 }),
      ),
      ...["TOP511", "TOP611"].map((ticker, index) =>
        fii(ticker, {
          rank: index + 5,
          weight: 1 / 6,
          price: 10,
          ceiling: 10.5,
          quantity: 100,
          macro: "Papel",
        }),
      ),
    ];
    const result = sunoCascade(3_000, assets);
    expect(reasonOf(result, "TOP111")).toBe("NA_META");
    // Metas de 1.608,33: cada um pede 63 cotas, abaixo do limite de 25% (R$ 750). O 3º tijolo
    // para na trava de 60% da macro (R$ 1.800), e o último papel leva o que o saldo ainda paga.
    expect(result.orders.map((item) => [item.ticker, item.quantity, item.limitedBy])).toEqual([
      ["TOP211", 63, null],
      ["TOP311", 63, null],
      ["TOP411", 54, "macro"],
      ["TOP511", 63, null],
      ["TOP611", 57, "saldo"],
    ]);
    expect(result.leftover).toBe(0);
  });

  it("B, pânico nos CRIs: papel para em 60% do aporte, e o resto cai no tijolo", () => {
    const papel = ["CRI111", "CRI211", "CRI311", "CRI411"].map((ticker, index) =>
      fii(ticker, { rank: index + 1, weight: 0.16, priceToBook: 0.85, macro: "Papel" }),
    );
    const tijolo = ["TIJ111", "TIJ211"].map((ticker, index) =>
      fii(ticker, { rank: index + 5, weight: 0.16 }),
    );
    const result = sunoCascade(10_000, [...papel, ...tijolo, anchor(90_000, 0.04)]);
    expect(result.orders.map((item) => [item.ticker, item.total])).toEqual([
      ["CRI111", 2_500],
      ["CRI211", 2_500],
      ["CRI311", 1_000],
      ["TIJ111", 2_500],
      ["TIJ211", 1_500],
    ]);
    expect(order(result, "CRI311")?.limitedBy).toBe("macro");
    expect(reasonOf(result, "CRI411")).toBe("LIMITE_MACRO");
    expect(result.leftover).toBe(0);
  });

  it("C, armadilha de valor: vacância e corte de provento esmagam o pedido", () => {
    const trap = fii("HGRU11", {
      rank: 1,
      priceToBook: 0.7,
      vacancy: 0.25,
      lastDividend: 0.5,
      dividends12m: 12,
    });
    const healthy = fii("SADI11", { rank: 2, priceToBook: 0.7 });
    const result = sunoCascade(1_000, [trap, healthy]);
    const ratio = order(result, "HGRU11")!.need / order(result, "SADI11")!.need;
    expect(ratio).toBeCloseTo(0.5 * 0.75);
  });

  it("C, provento zerado: o FII não recebe nem pela sobra", () => {
    const result = sunoCascade(1_000, [
      fii("ZERO11", { weight: 1, lastDividend: 0, dividends12m: 12 }),
    ]);
    expect(result.orders).toEqual([]);
    expect(reasonOf(result, "ZERO11")).toBe("PEDIDO_PEQUENO");
    expect(result.leftover).toBe(1_000);
  });
});

describe("sunoCascade: travas de risco", () => {
  it("o setor para em 35% do aporte", () => {
    const shoppings = ["SHO111", "SHO211", "SHO311"].map((ticker, index) =>
      fii(ticker, { rank: index + 1, weight: 0.2, sector: "Shoppings" }),
    );
    const logistics = fii("LOG111", { rank: 4, weight: 0.2, sector: "Logística" });
    const result = sunoCascade(10_000, [...shoppings, logistics, anchor(90_000, 0.2)]);
    expect(order(result, "SHO111")?.total).toBe(2_500);
    expect(order(result, "SHO211")).toMatchObject({ total: 1_000, limitedBy: "setor" });
    expect(reasonOf(result, "SHO311")).toBe("LIMITE_SETOR");
    expect(order(result, "LOG111")?.total).toBe(2_500);
    // Ninguém mais cabe nas travas: o resto fica guardado.
    expect(result.leftover).toBe(4_000);
  });
});

describe("sunoCascade: dinheiro sobrando", () => {
  it("a sobra ignora o ranking: uma cota por vez para o mais abaixo da meta", () => {
    // Todos pedem menos de uma cota. O limite por FII (R$ 100) dá uma cota a cada um, na ordem
    // da distância da meta; o mais perto dela, mesmo sendo o 1º do ranking, fica sem.
    const quantities = [10, 10.04, 10.08, 10.12, 10.16, 10.2];
    const assets = quantities.map((quantity, index) =>
      fii(`FII${index + 1}11`, {
        rank: index === 5 ? 1 : index + 2,
        weight: 1 / 6,
        ceiling: 101,
        quantity,
        macro: index < 3 ? "Tijolo" : "Papel",
      }),
    );
    const result = sunoCascade(500, assets);
    expect(result.orders.map((item) => [item.ticker, item.quantity, item.fromLeftover])).toEqual([
      ["FII111", 1, 1],
      ["FII211", 1, 1],
      ["FII311", 1, 1],
      ["FII411", 1, 1],
      ["FII511", 1, 1],
    ]);
    expect(reasonOf(result, "FII611")).toBe("PEDIDO_PEQUENO");
    expect(result.leftover).toBe(0);
  });

  it("a sobra respeita o limite por FII: o resto fica guardado", () => {
    const result = sunoCascade(1_000, [fii("AAAA11", { weight: 1 })]);
    expect(order(result, "AAAA11")).toMatchObject({ quantity: 2, total: 200 });
    expect(result.leftover).toBe(800);
  });
});

describe("sunoCascade: viés Aguardar", () => {
  it("sai com o motivo AGUARDAR, e o valor dele continua na base da estratégia", () => {
    // O AAAA11 seria o 1º da fila. Em Aguardar, os R$ 1.000 dele ainda contam na meta dos outros.
    const result = sunoCascade(4_000, [
      fii("AAAA11", { rank: 1, quantity: 10, bias: "AGUARDAR" }),
      fii("BBBB11", { rank: 2, quantity: 30 }),
    ]);
    expect(reasonOf(result, "AAAA11")).toBe("AGUARDAR");
    expect(order(result, "AAAA11")).toBeUndefined();
    expect(result.strategyValue).toBe(4_000);
    // Meta do BBBB11: 0,5 × (4.000 + 4.000) = 4.000, com 3.000 na carteira.
    expect(order(result, "BBBB11")?.gapBefore).toBe(1_000);
  });

  it("não recebe nem pela sobra: a cota dele vai para o próximo mais abaixo da meta", () => {
    // O cenário da sobra (acima) com o mais abaixo da meta em Aguardar: ele sai, e o mais perto
    // da meta, que antes ficava sem, leva a última cota.
    const quantities = [10, 10.04, 10.08, 10.12, 10.16, 10.2];
    const assets = quantities.map((quantity, index) =>
      fii(`FII${index + 1}11`, {
        rank: index === 5 ? 1 : index + 2,
        weight: 1 / 6,
        ceiling: 101,
        quantity,
        macro: index < 3 ? "Tijolo" : "Papel",
        bias: index === 0 ? "AGUARDAR" : null,
      }),
    );
    const result = sunoCascade(500, assets);
    expect(reasonOf(result, "FII111")).toBe("AGUARDAR");
    expect(result.orders.map((item) => [item.ticker, item.quantity, item.fromLeftover])).toEqual([
      ["FII611", 1, 1],
      ["FII211", 1, 1],
      ["FII311", 1, 1],
      ["FII411", 1, 1],
      ["FII511", 1, 1],
    ]);
    expect(result.leftover).toBe(0);
  });

  it("as regras de antes vêm primeiro: acima do teto ou sem teto mostram esse motivo", () => {
    const result = sunoCascade(1_000, [
      fii("AAAA11", { rank: 1, ceiling: 90, bias: "AGUARDAR" }),
      fii("BBBB11", { rank: 2, ceiling: null, bias: "AGUARDAR" }),
    ]);
    expect(reasonOf(result, "AAAA11")).toBe("ACIMA_DO_TETO");
    expect(reasonOf(result, "BBBB11")).toBe("SEM_TETO");
  });

  it("Comprar ou sem viés: o mesmo resultado", () => {
    const assets = [
      fii("AAAA11", { rank: 1, quantity: 10 }),
      fii("BBBB11", { rank: 2, quantity: 30 }),
    ];
    const plain = sunoCascade(4_000, assets);
    for (const bias of ["COMPRAR", null] as const) {
      expect(
        sunoCascade(
          4_000,
          assets.map((asset) => ({ ...asset, bias })),
        ),
      ).toEqual(plain);
    }
  });
});

describe("sunoCascade: freio de suspensão", () => {
  const v31 = ENGINE_VERSIONS["3.1"];
  /** O AAAA11 (1º do ranking, R$ 1.000 na carteira) com os dados de provento; o BBBB11 é o controle. */
  const pair = (days: number | null | undefined, payments: number | null, overrides = {}) => [
    fii("AAAA11", {
      rank: 1,
      quantity: 10,
      daysSinceLastDividend: days,
      dividendPayments12m: payments,
      ...overrides,
    }),
    fii("BBBB11", { rank: 2, quantity: 30 }),
  ];
  /** O mesmo par, sem os dados de provento. */
  const plain = pair(undefined, null);

  it("46 dias sem data ex e 12 pagamentos: sai, nem pela sobra, e o valor fica na base", () => {
    const result = sunoCascade(4_000, pair(46, 12), v31);
    expect(reasonOf(result, "AAAA11")).toBe("PROVENTO_SUSPENSO");
    expect(order(result, "AAAA11")).toBeUndefined();
    expect(result.orders.map((item) => item.ticker)).toEqual(["BBBB11"]);
    expect(result.strategyValue).toBe(4_000);
    // Meta do BBBB11: 0,5 × (4.000 + 4.000) = 4.000, com 3.000 na carteira.
    expect(order(result, "BBBB11")?.gapBefore).toBe(1_000);
    // O BBBB11 só leva a trava de 25% do aporte, e a sobra não vai para o suspenso.
    expect(result.leftover).toBe(3_000);
  });

  it("44 dias e 12 pagamentos: recebe como hoje", () => {
    const result = sunoCascade(4_000, pair(44, 12), v31);
    expect(order(result, "AAAA11")).toBeDefined();
    expect(result).toEqual(sunoCascade(4_000, plain, v31));
  });

  it("60 dias e 5 pagamentos: não é pagador regular, então não é suspenso", () => {
    const result = sunoCascade(4_000, pair(60, 5), v31);
    expect(order(result, "AAAA11")).toBeDefined();
    expect(result).toEqual(sunoCascade(4_000, plain, v31));
  });

  it("366 dias e 1 pagamento: suspenso mesmo sem ser regular", () => {
    const result = sunoCascade(4_000, pair(366, 1), v31);
    expect(reasonOf(result, "AAAA11")).toBe("PROVENTO_SUSPENSO");
    expect(order(result, "AAAA11")).toBeUndefined();
  });

  it("as bordas: 45 dias e 365 dias ainda não suspendem; 6 pagamentos já contam como regular", () => {
    const suspended = (days: number, payments: number | null) =>
      isDividendSuspended(pair(days, payments)[0]!, v31);
    expect(suspended(45, 12)).toBe(false);
    expect(suspended(46, 6)).toBe(true);
    expect(suspended(46, 5)).toBe(false);
    expect(suspended(46, null)).toBe(false);
    expect(suspended(365, 1)).toBe(false);
    expect(suspended(366, null)).toBe(true);
  });

  it("sem a data do último provento (null ou ausente): neutro", () => {
    for (const days of [null, undefined]) {
      const result = sunoCascade(4_000, pair(days, 12), v31);
      expect(order(result, "AAAA11")).toBeDefined();
      expect(result).toEqual(sunoCascade(4_000, plain, v31));
    }
  });

  it("as regras de antes vêm primeiro: acima do teto e 100 dias mostra ACIMA_DO_TETO", () => {
    const result = sunoCascade(4_000, pair(100, 12, { ceiling: 90 }), v31);
    expect(reasonOf(result, "AAAA11")).toBe("ACIMA_DO_TETO");
  });

  it("o viés Aguardar também vem antes do provento suspenso", () => {
    const result = sunoCascade(4_000, pair(100, 12, { bias: "AGUARDAR" }), v31);
    expect(reasonOf(result, "AAAA11")).toBe("AGUARDAR");
  });

  it("na 3.0 (opção desligada) o mesmo FII de 100 dias recebe", () => {
    const v30 = ENGINE_VERSIONS["3.0"];
    const result = sunoCascade(4_000, pair(100, 12), v30);
    expect(order(result, "AAAA11")).toBeDefined();
    expect(result).toEqual(sunoCascade(4_000, plain, v30));
    // Sem opções, o motor também roda a 3.0.
    expect(sunoCascade(4_000, pair(100, 12))).toEqual(sunoCascade(4_000, plain));
  });

  it("aportePriorities marca PROVENTO_SUSPENSO, e quem vem depois sobe na fila", () => {
    const assets = (days: number) => [
      fii("AAAA11", {
        rank: 1,
        weight: 0.25,
        quantity: 10,
        daysSinceLastDividend: days,
        dividendPayments12m: 12,
      }),
      fii("BBBB11", { rank: 2, weight: 0.25, quantity: 10 }),
      fii("CCCC11", { rank: 3, weight: 0.5, quantity: 60 }),
    ];
    const priorities = aportePriorities(assets(46), v31);
    expect(priorities.get("AAAA11")).toEqual({ kind: "fora", reason: "PROVENTO_SUSPENSO" });
    expect(priorities.get("BBBB11")).toEqual({ kind: "fila", position: 1 });
    // Na 3.0 o mesmo FII segue na fila, na frente do BBBB11.
    const v30 = aportePriorities(assets(46));
    expect(v30.get("AAAA11")).toEqual({ kind: "fila", position: 1 });
    expect(v30.get("BBBB11")).toEqual({ kind: "fila", position: 2 });
  });
});

// Gerador determinístico (LCG): os mesmos 500 casos a cada execução.
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}
const macros = ["Papel", "Tijolo", "Outros"] as const;
const sectors = [null, null, "Shoppings", "Logística"];

// As 500 carteiras da semente 42, as mesmas para os testes de invariantes e do mínimo por ordem.
function portfolios() {
  const next = random(42);
  return Array.from({ length: 500 }, () => {
    const count = 1 + Math.floor(next() * 10);
    const assets = Array.from({ length: count }, (_, index) => {
      const price = Math.round((5 + next() * 150) * 100) / 100;
      return fii(`F${String.fromCharCode(65 + index)}XX11`, {
        rank: next() < 0.1 ? null : 1 + Math.floor(next() * 20),
        price,
        ceiling: price * (0.9 + next() * 0.4),
        weight: 1 / count,
        quantity: Math.floor(next() * 400),
        priceToBook: next() < 0.7 ? 0.6 + next() * 0.6 : null,
        lastDividend: next() < 0.7 ? next() : null,
        dividends12m: next() < 0.7 ? next() * 12 : null,
        vacancy: next() < 0.5 ? next() * 0.3 : null,
        macro: macros[Math.floor(next() * 3)],
        sector: sectors[Math.floor(next() * 4)],
      });
    });
    const amount = Math.round(next() * 30_000 * 100) / 100;
    return { amount, assets };
  });
}

describe("sunoCascade: invariantes", () => {
  it("com as opções da 3.0, o resultado é o mesmo que sem opções", () => {
    for (const { amount, assets } of portfolios()) {
      expect(sunoCascade(amount, assets, ENGINE_VERSIONS["3.0"])).toEqual(
        sunoCascade(amount, assets),
      );
      expect(aportePriorities(assets, ENGINE_VERSIONS["3.0"])).toEqual(aportePriorities(assets));
    }
  });

  it("nunca passa das travas nem do aporte, e só compra elegíveis", () => {
    for (const { amount, assets } of portfolios()) {
      const result = sunoCascade(amount, assets);
      const byTicker = new Map(assets.map((asset) => [asset.ticker, asset]));

      expect(result.leftover).toBeGreaterThanOrEqual(0);
      expect(Math.abs(result.spent + result.leftover - result.amount)).toBeLessThan(0.005);
      const bySector = new Map<string, number>();
      const byMacro = new Map<string, number>();
      for (const item of result.orders) {
        const asset = byTicker.get(item.ticker)!;
        expect(asset.rank).not.toBeNull();
        expect(asset.price!).toBeLessThan(asset.ceiling!);
        expect(item.total).toBeLessThanOrEqual(RISK_CAPS.asset * result.amount + 1e-6);
        if (asset.sector)
          bySector.set(asset.sector, (bySector.get(asset.sector) ?? 0) + item.total);
        byMacro.set(asset.macro, (byMacro.get(asset.macro) ?? 0) + item.total);
      }
      for (const total of bySector.values()) {
        expect(total).toBeLessThanOrEqual(RISK_CAPS.sector * result.amount + 1e-6);
      }
      for (const total of byMacro.values()) {
        expect(total).toBeLessThanOrEqual(RISK_CAPS.macro * result.amount + 1e-6);
      }
    }
  });
});

describe("sunoCascade: mínimo por ordem", () => {
  const v31 = ENGINE_VERSIONS["3.1"];
  const cents = (value: number) => Math.round(value * 100);

  it("nas 500 carteiras: nenhuma ordem abaixo do mínimo, o aporte fecha e só elegíveis compram", () => {
    for (const { amount, assets } of portfolios()) {
      const result = sunoCascade(amount, assets, v31);
      const byTicker = new Map(assets.map((asset) => [asset.ticker, asset]));
      const fairShare = Math.min(
        result.amount / assets.length,
        (RISK_CAPS.asset * result.amount) / 2,
      );

      expect(result.minimum).toBe(Math.round(fairShare * 100) / 100);
      expect(result.leftover).toBeGreaterThanOrEqual(0);
      expect(cents(result.spent) + cents(result.leftover)).toBe(cents(result.amount));
      for (const item of result.orders) {
        const asset = byTicker.get(item.ticker)!;
        expect(item.total).toBeGreaterThanOrEqual(result.minimum - 0.005);
        expect(asset.rank).not.toBeNull();
        expect(asset.price!).toBeLessThan(asset.ceiling!);
        expect(asset.bias).not.toBe("AGUARDAR");
        expect(item.total).toBeLessThanOrEqual(RISK_CAPS.asset * result.amount + 1e-6);
      }
    }
  });

  it("o dinheiro desce na fila: o 1º pede menos que o mínimo e o 2º recebe mais que na 3.0", () => {
    // Aporte de 10.000 com 3 FIIs: mínimo de 1.250 (12,5% do aporte, menor que 10.000 ÷ 3).
    const assets = [
      // Meta de 4.000 com 2.900 na carteira: pede 1.100 × 1,1667 = 1.283, ou 12 cotas (1.200).
      fii("AAAA11", { rank: 1, weight: 0.2, quantity: 29, ceiling: 120, sector: "Shoppings" }),
      fii("BBBB11", { rank: 2, weight: 0.4, sector: "Shoppings" }),
      fii("CCCC11", { rank: 3, weight: 0.4, quantity: 71, macro: "Papel" }),
    ];
    const before = sunoCascade(10_000, assets);
    const after = sunoCascade(10_000, assets, v31);
    expect(after.minimum).toBe(1_250);

    // Na 3.0 o AAAA11 leva 1.200, e o setor (35%) deixa só 2.300 para o BBBB11.
    expect(order(before, "AAAA11")?.total).toBe(1_200);
    expect(order(before, "BBBB11")).toMatchObject({ total: 2_300, limitedBy: "setor" });
    // Na 3.1 o AAAA11 fica sem ordem, e o BBBB11 vai até a trava de 25%. Na sobra, o AAAA11 só
    // entraria com 13 cotas (1.300), mais que os 1.000 que o setor ainda tem.
    expect(order(after, "AAAA11")).toBeUndefined();
    expect(reasonOf(after, "AAAA11")).toBe("ABAIXO_DO_MINIMO");
    expect(order(after, "BBBB11")).toMatchObject({ total: 2_500, limitedBy: "ativo" });
  });

  it("a sobra abre ordem nova só no mínimo, de uma vez; quem já tem ordem recebe de 1 em 1", () => {
    // Aporte de 10.000 com 4 FIIs na entrada: mínimo de 1.250, ou 13 cotas de R$ 100.
    const assets = [
      // Meta de 4.000 com 2.300: pede 1.700 × 1,0909 = 1.854, ou 18 cotas.
      fii("YYYY11", { rank: 1, weight: 0.2, quantity: 23, macro: "Papel" }),
      // Sem cotas: vai até a trava de 25% (2.500).
      fii("WWWW11", { rank: 2, weight: 0.25, macro: "Papel" }),
      // Meta de 1.500 com 1.000: pede 545, ou 5 cotas (500), abaixo do mínimo.
      fii("XXXX11", { rank: 3, weight: 0.075, quantity: 10, macro: "Papel" }),
      anchor(6_700, 0.475),
    ];
    const result = sunoCascade(10_000, assets, v31);
    expect(result.minimum).toBe(1_250);
    // Depois do passo 1, papel tem 1.700 de espaço (60% − 1.800 − 2.500). O XXXX11 é o mais abaixo
    // da meta (1.000 ÷ 1.500) e entra com as 13 cotas de uma vez; passa para 2.300 ÷ 1.500, e o
    // YYYY11 (4.100 ÷ 4.000) leva o resto, uma cota por vez, até papel encher.
    expect(order(result, "XXXX11")).toMatchObject({ quantity: 13, fromLeftover: 13, total: 1_300 });
    expect(order(result, "YYYY11")).toMatchObject({ quantity: 22, fromLeftover: 4 });
    expect(order(result, "WWWW11")).toMatchObject({ quantity: 25, fromLeftover: 0 });
    expect(result.leftover).toBe(4_000);
  });

  it("sem espaço para o mínimo, o FII sem ordem não entra pela sobra", () => {
    // O mesmo cenário com o VVVV11, que vem depois na fila e ocupa 1.500 do papel: sobram 200, e
    // só o YYYY11, que já tem ordem, recebe (2 cotas). O XXXX11 precisaria de 1.300.
    const assets = [
      fii("YYYY11", { rank: 1, weight: 0.2, quantity: 23, macro: "Papel" }),
      fii("WWWW11", { rank: 2, weight: 0.25, macro: "Papel" }),
      fii("XXXX11", { rank: 3, weight: 0.075, quantity: 10, macro: "Papel" }),
      // Meta de 1.400 sem cotas: pede 1.527, ou 15 cotas.
      fii("VVVV11", { rank: 4, weight: 0.07, macro: "Papel" }),
      anchor(6_700, 0.405),
    ];
    const result = sunoCascade(10_000, assets, v31);
    expect(result.minimum).toBe(1_250);
    expect(order(result, "XXXX11")).toBeUndefined();
    expect(reasonOf(result, "XXXX11")).toBe("ABAIXO_DO_MINIMO");
    expect(order(result, "YYYY11")).toMatchObject({ quantity: 20, fromLeftover: 2 });
    expect(order(result, "VVVV11")).toMatchObject({ quantity: 15, fromLeftover: 0 });
  });

  it("o motivo da trava vence: um pedido acima do mínimo cortado pelo saldo sai como SEM_SALDO", () => {
    // Base de 100.000 (90.000 na âncora): os três primeiros vão até a trava de 25%, o DDDD11 leva
    // 1.600 e sobram 900 de saldo para o EEEE11, que pedia 1.636 (16 cotas, acima do mínimo).
    const assets = [
      fii("AAAA11", { rank: 1, weight: 0.03, macro: "Papel" }),
      fii("BBBB11", { rank: 2, weight: 0.03, macro: "Tijolo" }),
      fii("CCCC11", { rank: 3, weight: 0.03, macro: "Outros" }),
      fii("DDDD11", { rank: 4, weight: 0.015, macro: "Papel" }),
      fii("EEEE11", { rank: 5, weight: 0.015, macro: "Tijolo" }),
      anchor(90_000, 0.88),
    ];
    const result = sunoCascade(10_000, assets, v31);
    expect(result.minimum).toBe(1_250);
    expect(order(result, "DDDD11")).toMatchObject({ quantity: 25, fromLeftover: 9 });
    expect(order(result, "EEEE11")).toBeUndefined();
    expect(reasonOf(result, "EEEE11")).toBe("SEM_SALDO");
  });

  it("o mínimo é no máximo 12,5% do aporte, metade da trava por FII", () => {
    const assets = ["AAAA11", "BBBB11", "CCCC11", "DDDD11"].map((ticker, index) =>
      fii(ticker, { rank: index + 1, weight: 0.25 }),
    );
    // 10.000 ÷ 4 = 2.500, mas o limite é 12,5% de 10.000.
    expect(sunoCascade(10_000, assets, v31).minimum).toBe(1_250);
  });

  it("aporte zero, nenhum FII ou a 3.0: mínimo zero", () => {
    const assets = [fii("AAAA11", { weight: 1 })];
    expect(sunoCascade(0, assets, v31).minimum).toBe(0);
    expect(sunoCascade(10_000, [], v31).minimum).toBe(0);
    expect(sunoCascade(10_000, assets, ENGINE_VERSIONS["3.0"]).minimum).toBe(0);
    expect(sunoCascade(10_000, assets).minimum).toBe(0);
  });
});

describe("aportePriorities", () => {
  it("a fila segue o ranking entre quem pede ao menos uma cota; os outros mostram o motivo", () => {
    const assets = [
      fii("AAAA11", { rank: 2, weight: 0.25, quantity: 10 }),
      fii("BBBB11", { rank: 1, weight: 0.25, quantity: 10 }),
      fii("CCCC11", { rank: 3, weight: 0.25, quantity: 30 }),
      fii("DDDD11", { rank: 4, weight: 0.25, quantity: 16 }),
      fii("EEEE11", { rank: 5, weight: 0, ceiling: 90 }),
      fii("FFFF11", { rank: null, weight: 0 }),
    ];
    const priorities = aportePriorities(assets);
    expect(priorities.get("BBBB11")).toEqual({ kind: "fila", position: 1 });
    expect(priorities.get("AAAA11")).toEqual({ kind: "fila", position: 2 });
    expect(priorities.get("CCCC11")).toEqual({ kind: "fora", reason: "NA_META" });
    expect(priorities.get("DDDD11")).toEqual({ kind: "fora", reason: "PEDIDO_PEQUENO" });
    expect(priorities.get("EEEE11")).toEqual({ kind: "fora", reason: "ACIMA_DO_TETO" });
    expect(priorities.get("FFFF11")).toEqual({ kind: "fora", reason: "SEM_RANKING" });
  });

  it("o FII com Aguardar sai da fila com o motivo, e quem vem depois sobe", () => {
    const priorities = aportePriorities([
      fii("AAAA11", { rank: 1, weight: 0.25, quantity: 10, bias: "AGUARDAR" }),
      fii("BBBB11", { rank: 2, weight: 0.25, quantity: 10 }),
      fii("CCCC11", { rank: 3, weight: 0.5, quantity: 60 }),
    ]);
    expect(priorities.get("AAAA11")).toEqual({ kind: "fora", reason: "AGUARDAR" });
    expect(priorities.get("BBBB11")).toEqual({ kind: "fila", position: 1 });
    expect(priorities.get("CCCC11")).toEqual({ kind: "fora", reason: "NA_META" });
  });
});
