import { describe, expect, it } from "vitest";
import { RISK_CAPS } from "./risk";
import { aportePriorities, sunoCascade, type CascadeAsset } from "./suno-cascade";

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
  it("é o gap vezes os tensores, e o limite por FII corta o que passar de 33%", () => {
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
    expect(first).toMatchObject({ quantity: 33, fromLeftover: 0, limitedBy: "ativo" });
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
    // Metas de 1.608,33: cada um pede 63 cotas. O 3º tijolo para na trava de 60% da macro
    // (R$ 1.800), e o último papel leva o que o saldo ainda paga.
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
      ["CRI111", 3_300],
      ["CRI211", 2_700],
      ["TIJ111", 3_300],
      ["TIJ211", 700],
    ]);
    expect(order(result, "CRI211")?.limitedBy).toBe("macro");
    expect(reasonOf(result, "CRI311")).toBe("LIMITE_MACRO");
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
    expect(order(result, "SHO111")?.total).toBe(3_300);
    expect(order(result, "SHO211")).toMatchObject({ total: 200, limitedBy: "setor" });
    expect(reasonOf(result, "SHO311")).toBe("LIMITE_SETOR");
    // A logística tem setor próprio, mas divide a macro tijolo (60%) com os shoppings.
    expect(order(result, "LOG111")).toMatchObject({ total: 2_500, limitedBy: "macro" });
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
    expect(order(result, "AAAA11")).toMatchObject({ quantity: 3, total: 300 });
    expect(result.leftover).toBe(700);
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
  const macros = ["Papel", "Tijolo", "Outros"] as const;
  const sectors = [null, null, "Shoppings", "Logística"];

  it("nunca passa das travas nem do aporte, e só compra elegíveis", () => {
    const next = random(42);
    for (let run = 0; run < 500; run++) {
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
});
