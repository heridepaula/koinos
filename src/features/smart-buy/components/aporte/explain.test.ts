import { describe, expect, it } from "vitest";
import type { CascadeOrder } from "../../domain/fii-cascade";
import type { StockBuyOrder, StockExclusionReason } from "../../domain/stock-buy";
import {
  calcSteps,
  calcSummary,
  explain,
  explainStock,
  groupExcluded,
  NEUTRAL_REASON_HELP,
  plainReason,
  plainStockReason,
  REASON_HELP,
  reasonHelp,
  shortReason,
  shortStockReason,
  STOCK_REASON_HELP,
  stockCalcSteps,
  stockCalcSummary,
  unitOf,
} from "./explain";

const neutral = { valuation: 1, dividends: 1, safety: 1, vacancy: 1 };

function order(overrides: Partial<CascadeOrder> = {}): CascadeOrder {
  return {
    ticker: "AAAA11",
    rank: 3,
    quantity: 10,
    fromLeftover: 0,
    price: 100,
    total: 1_000,
    weightBefore: 0.04,
    weightAfter: 0.05,
    targetWeight: 0.05,
    marginToCeiling: 0.05,
    priceToBook: null,
    vacancy: null,
    dividendRatio: null,
    tensors: neutral,
    macro: "Tijolo",
    sector: null,
    fillBefore: 0.8,
    gapBefore: 2_000,
    need: 2_000,
    limitedBy: null,
    gapAfter: 1_000,
    ...overrides,
  };
}

describe("shortReason", () => {
  it("ranking, distância da meta e o sinal que mais pesou", () => {
    expect(
      shortReason(order({ priceToBook: 0.84, tensors: { ...neutral, valuation: 1.16 } })),
    ).toBe("3º do ranking · 20% abaixo da meta · P/VP 0,84");
  });

  it("um freio ou uma trava aparece antes do desconto", () => {
    expect(
      shortReason(
        order({ priceToBook: 0.7, tensors: { ...neutral, valuation: 1.3, dividends: 0.6 } }),
      ),
    ).toBe("3º do ranking · 20% abaixo da meta · provento caiu");
    expect(shortReason(order({ limitedBy: "setor", sector: "Shoppings" }))).toBe(
      "3º do ranking · 20% abaixo da meta · limite do setor",
    );
  });

  it("só da sobra: diz isso e onde o FII está em relação à meta", () => {
    expect(shortReason(order({ fromLeftover: 10, gapBefore: -50, fillBefore: 1.01 }))).toBe(
      "Sobra do aporte · já na meta",
    );
  });

  it("falta quase nada: não mostra 0%", () => {
    expect(shortReason(order({ fillBefore: 0.998 }))).toBe("3º do ranking · quase na meta");
  });
});

describe("explain", () => {
  it("lista cada tensor que mexeu no pedido, o pedido e a trava", () => {
    const parts = explain(
      order({
        priceToBook: 0.9,
        vacancy: 0.1,
        dividendRatio: 0.5,
        tensors: { valuation: 1.1, dividends: 0.5, safety: 1.05, vacancy: 0.9 },
        limitedBy: "ativo",
      }),
    );
    expect(parts).toContain("P/VP 0,9 (×1,1)");
    expect(parts).toContain("último provento 50% da média de 12 meses (×0,5)");
    expect(parts).toContain("vacância de 10,0% (×0,9)");
    expect(parts).toContain("limite de 25% do aporte por FII");
  });
});

// O RECR11 do `lab recomendar --valor 10000` de 2026-11-14.
const recr = () =>
  order({
    ticker: "RECR11",
    rank: 6,
    quantity: 26,
    price: 68.7,
    total: 1_786.2,
    fillBefore: 0.947,
    gapBefore: 1_421.08,
    need: 1_850.97,
    priceToBook: 0.77,
    dividendRatio: 0.86,
    marginToCeiling: 0.24,
    macro: "Papel",
    tensors: { valuation: 1.23, dividends: 0.86, safety: 1.24, vacancy: 1 },
  });
const plainText = (text: string) => text.replace(/ /g, " ");

describe("plainReason", () => {
  it("a decisão do método em palavras, sem siglas", () => {
    expect(plainReason(recr())).toBe(
      "6º na lista do método · faltam 5% para a meta · rendimento caiu",
    );
    expect(
      plainReason(order({ priceToBook: 0.84, tensors: { ...neutral, valuation: 1.16 } })),
    ).toBe("3º na lista do método · faltam 20% para a meta · desconto no preço");
    expect(plainReason(order({ tensors: { ...neutral, safety: 1.2 } }))).toBe(
      "3º na lista do método · faltam 20% para a meta · bem abaixo do teto",
    );
  });
  it("sobra, quase na meta e trava", () => {
    expect(plainReason(order({ fromLeftover: 10, gapBefore: -50, fillBefore: 1.01 }))).toBe(
      "Sobra do aporte · já na meta",
    );
    expect(plainReason(order({ fillBefore: 0.998 }))).toBe("3º na lista do método · quase na meta");
    expect(plainReason(order({ limitedBy: "setor", sector: "Shoppings" }))).toBe(
      "3º na lista do método · faltam 20% para a meta · limite do setor",
    );
  });
});

describe("calcSteps", () => {
  it("cada tensor que mexeu, com o efeito e o multiplicador exato", () => {
    const steps = calcSteps(recr());
    expect(steps.map((s) => s.label)).toEqual([
      "Posição na lista do método",
      "Faltava para a meta",
      "Preço sobre o patrimônio",
      "Margem até o teto",
      "Último rendimento",
    ]);
    expect(steps.map((s) => s.effect)).toEqual([null, null, "mais", "mais", "menos"]);
    expect(steps.map((s) => s.exact)).toEqual([null, null, "×1,23", "×1,24", "×0,86"]);
    expect(steps.map((s) => plainText(s.value))).toEqual([
      "6º",
      "R$ 1.421,08 (5%)",
      "P/VP 0,77",
      "24%",
      "14% abaixo da média de 12 meses",
    ]);
  });
  it("vacância só no tijolo; na meta, só a posição e a distância", () => {
    const brick = calcSteps(
      order({ vacancy: 0.12, tensors: { ...neutral, vacancy: 0.88 }, macro: "Tijolo" }),
    );
    expect(brick.at(-1)).toMatchObject({ label: "Vacância", effect: "menos", exact: "×0,88" });
    expect(
      calcSteps(order({ fromLeftover: 10, gapBefore: -50, fillBefore: 1.01 })).map((s) => s.value),
    ).toEqual(["3º", "já na meta"]);
  });
});

describe("calcSummary", () => {
  it("liga o que faltava ao pedido e à compra", () => {
    expect(plainText(calcSummary(recr()))).toBe(
      "Faltavam R$ 1.421,08 para a meta. O método pediu R$ 1.850,97 (mais pelo desconto no preço e pela margem até o teto, menos pelo rendimento menor) e comprou R$ 1.786,20 (26 cotas).",
    );
  });
  it("a trava, o saldo e a sobra", () => {
    expect(plainText(calcSummary(order({ limitedBy: "ativo" })))).toBe(
      "Faltavam R$ 2.000,00 para a meta. O método pediu R$ 2.000,00 e comprou R$ 1.000,00 (10 cotas). O limite de 25% do aporte por FII cortou o pedido.",
    );
    expect(calcSummary(order({ limitedBy: "saldo" }))).toContain(
      "O saldo do aporte acabou antes do pedido.",
    );
    expect(calcSummary(order({ quantity: 12, fromLeftover: 2 }))).toContain(
      "2 cota(s) vieram da sobra.",
    );
    expect(
      plainText(calcSummary(order({ fromLeftover: 10, gapBefore: -50, fillBefore: 1.01 }))),
    ).toBe("Já estava na meta: comprou R$ 1.000,00 (10 cotas) com a sobra do aporte.");
  });
});

describe("ações", () => {
  const stock: StockBuyOrder = {
    ticker: "WEGE3",
    rank: 1,
    quantity: 10,
    fromLeftover: 0,
    lot: 1,
    price: 51,
    total: 510,
    marginOfSafety: 70 / 51 - 1,
    deficitBefore: 1_200,
    targetValue: 2_000,
    targetWeight: 0.2,
    weightBefore: 0.1,
    weightAfter: 0.15,
  };
  const plain = (text: string) => text.replace(/ /g, " ");

  it("a margem de segurança e o que faltava para a meta", () => {
    expect(plain(explainStock(stock))).toBe(
      "Margem de segurança de 37% (teto R$ 70,00, preço R$ 51,00) · faltavam R$ 1.200,00 para a meta de 20,0%",
    );
  });

  it("as versões em palavras", () => {
    expect(plain(plainStockReason(stock))).toBe(
      "Margem de segurança de 37% · faltavam R$ 1.200,00 para a meta",
    );
    expect(stockCalcSteps(stock).map((s) => plain(s.value))).toEqual([
      "37% (teto R$ 70,00)",
      "R$ 1.200,00",
    ]);
    expect(plain(stockCalcSummary(stock))).toBe(
      "Faltavam R$ 1.200,00 para a meta de 20,0%. Comprou R$ 510,00 (10 ações).",
    );
    const lots = { ...stock, quantity: 300, fromLeftover: 200, lot: 100, total: 15_300 };
    expect(plain(stockCalcSummary(lots))).toBe(
      "Faltavam R$ 1.200,00 para a meta de 20,0%. Comprou R$ 15.300,00 (300 ações, em lotes de 100). 2 lote(s) vieram da sobra.",
    );
    expect(plain(plainStockReason(lots))).toContain("2 lote(s) pela sobra");
  });

  it("a linha curta", () => {
    expect(plain(shortStockReason(stock))).toBe(
      "margem de segurança de 37% · faltavam R$ 1.200,00",
    );
  });

  it("sem déficit (compra da sobra), diz que já estava na meta, sem valor negativo", () => {
    const onTarget = { ...stock, deficitBefore: -300, fromLeftover: 10 };
    expect(plain(explainStock(onTarget))).toContain("já estava na meta");
    expect(plain(shortStockReason(onTarget))).toContain("já estava na meta");
    expect(explainStock(onTarget)).not.toContain("faltavam");
    expect(shortStockReason(onTarget)).not.toContain("-");
  });

  it("com sobra, diz quantos lotes vieram dela; sem sobra, o texto é o de antes", () => {
    const leftover = { ...stock, quantity: 300, fromLeftover: 200, lot: 100 };
    expect(shortStockReason(leftover)).toContain("2 lote(s) pela sobra");
    expect(plain(shortStockReason(leftover))).toBe(
      "margem de segurança de 37% · faltavam R$ 1.200,00 · 2 lote(s) pela sobra",
    );
    expect(explainStock(leftover)).toContain(" · 2 lote(s) pela sobra");
    expect(explainStock(leftover).startsWith(explainStock(stock))).toBe(true);
    expect(shortStockReason(stock)).not.toContain("sobra");
    expect(explainStock(stock)).not.toContain("sobra");
  });
});

describe("unitOf", () => {
  it("cota(s) nos FIIs e ação(ões) nas ações", () => {
    expect([unitOf("FII", 1), unitOf("FII", 3), unitOf("ACAO", 1), unitOf("ACAO", 3)]).toEqual([
      "cota",
      "cotas",
      "ação",
      "ações",
    ]);
  });
});

describe("fora deste aporte", () => {
  const fii = { ticker: "HGLG11", kind: "FII" } as const;
  const stock = { ticker: "VALE3", kind: "ACAO" } as const;
  const shared: StockExclusionReason[] = [
    "SEM_COTACAO",
    "SEM_TETO",
    "ACIMA_DO_TETO",
    "AGUARDAR",
    "NA_META",
    "PEDIDO_PEQUENO",
    "SEM_SALDO",
  ];

  it("só FIIs no motivo: o texto dos FIIs", () => {
    for (const reason of shared) expect(reasonHelp(reason, [fii])).toBe(REASON_HELP[reason]);
    expect(reasonHelp("LIMITE_SETOR", [fii])).toBe(REASON_HELP.LIMITE_SETOR);
    expect(reasonHelp("PEDIDO_PEQUENO", [fii])).toContain("não chega a uma cota");
  });

  it("só ações no motivo: o texto das ações", () => {
    for (const reason of shared) {
      expect(reasonHelp(reason, [stock, stock])).toBe(STOCK_REASON_HELP[reason]);
    }
    expect(reasonHelp("PEDIDO_PEQUENO", [stock])).toBe(
      "Falta pouco para a meta: não chega a uma ação.",
    );
  });

  it("FIIs e ações no mesmo motivo: um texto que serve para as duas classes", () => {
    for (const reason of shared) {
      expect(reasonHelp(reason, [fii, stock])).toBe(NEUTRAL_REASON_HELP[reason]);
      expect(reasonHelp(reason, [stock, fii])).toBe(NEUTRAL_REASON_HELP[reason]);
    }
    expect(reasonHelp("AGUARDAR", [fii, stock])).toBe(
      "Com viés Aguardar na Carteira Alvo: não recebe aporte.",
    );
    expect(reasonHelp("PEDIDO_PEQUENO", [fii, stock])).toContain("não chega a uma cota ou ação");
  });

  it("os motivos novos da 3.1: dois só de FIIs e um só de ações", () => {
    for (const reason of ["ABAIXO_DO_MINIMO", "PROVENTO_SUSPENSO"] as const) {
      expect(reasonHelp(reason, [fii])).toBe(REASON_HELP[reason]);
      expect(reasonHelp(reason, [fii, fii])).toBe(REASON_HELP[reason]);
    }
    expect(reasonHelp("ABAIXO_DO_MINIMO", [fii])).toContain("mínimo por ordem");
    expect(reasonHelp("PROVENTO_SUSPENSO", [fii])).toContain("sem data ex");

    expect(reasonHelp("MENOS_DE_UM_LOTE", [stock])).toBe(STOCK_REASON_HELP.MENOS_DE_UM_LOTE);
    expect(reasonHelp("MENOS_DE_UM_LOTE", [fii, stock])).toBe(NEUTRAL_REASON_HELP.MENOS_DE_UM_LOTE);
    expect(reasonHelp("MENOS_DE_UM_LOTE", [stock])).toContain("lote de 100 ações");
  });

  it("junta as duas carteiras por motivo, os FIIs antes das ações", () => {
    const byReason = groupExcluded(
      [
        { ticker: "KNRI11", reason: "ACIMA_DO_TETO" },
        { ticker: "HGLG11", reason: "LIMITE_SETOR" },
        { ticker: "XPML11", reason: "ACIMA_DO_TETO" },
      ],
      [
        { ticker: "VALE3", reason: "ACIMA_DO_TETO" },
        { ticker: "ITSA4", reason: "AGUARDAR" },
      ],
    );
    expect([...byReason.keys()]).toEqual(["ACIMA_DO_TETO", "LIMITE_SETOR", "AGUARDAR"]);
    expect(byReason.get("ACIMA_DO_TETO")).toEqual([
      { ticker: "KNRI11", kind: "FII" },
      { ticker: "XPML11", kind: "FII" },
      { ticker: "VALE3", kind: "ACAO" },
    ]);
    expect(byReason.get("AGUARDAR")).toEqual([{ ticker: "ITSA4", kind: "ACAO" }]);
  });
});
