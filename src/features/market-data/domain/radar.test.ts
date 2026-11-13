import { describe, expect, it } from "vitest";
import { CEILING_CHECK } from "@/features/strategy";
import {
  buildRadarPrompt,
  businessKind,
  describeAsset,
  dividendTrend,
  factsKey,
  monthChange,
  needsRadar,
  RADAR,
  RADAR_EXAMPLES,
  radarChips,
  radarFacts,
  radarSources,
  validateRadarText,
  type FiiRadarInput,
  type StockRadarInput,
} from "./radar";
import type { StockIndicators } from "./fundamentus-indicators";

const fii = (over: Partial<FiiRadarInput> = {}): FiiRadarInput => ({
  kind: "FII",
  macro: "Tijolo",
  segment: null,
  fundType: null,
  pvp: null,
  dividendRatio: null,
  suspended: false,
  dy12m: null,
  realRate: null,
  vacancy: null,
  peerDy: [],
  dividendTrend: null,
  monthChange: null,
  yearChange: null,
  ...over,
});

const indicators = (over: Partial<StockIndicators> = {}): StockIndicators => ({
  kind: "ACAO",
  sector: "Químicos",
  subsector: "Químicos Diversos",
  balanceDate: null,
  pl: null,
  pvp: null,
  netMargin: null,
  ebitMargin: null,
  roe: null,
  roic: null,
  netDebtToEquity: null,
  currentRatio: null,
  revenueGrowth5y: null,
  netIncome12m: 1,
  ...over,
});

const stock = (
  over: Partial<StockRadarInput> = {},
  ind: Partial<StockIndicators> = {},
): StockRadarInput => {
  const merged = indicators(ind);
  return {
    kind: "ACAO",
    business: businessKind(merged.sector, merged.subsector),
    isBank: merged.subsector === "Bancos",
    indicators: merged,
    dy12m: null,
    payments12m: null,
    dividendsKnown: false,
    monthChange: null,
    yearChange: null,
    ...over,
  };
};

const ids = (input: FiiRadarInput | StockRadarInput) => radarFacts(input).map((fact) => fact.id);

describe("radarFacts: FIIs", () => {
  it.each([
    [0.74, ["pvp-bem-baixo"]],
    [0.75, ["pvp-baixo"]],
    [0.84, ["pvp-baixo"]],
    [0.85, []],
    [1.05, []],
    [1.06, ["pvp-alto"]],
    [1.2, ["pvp-alto"]],
    [1.21, ["pvp-bem-alto"]],
  ])("P/VP %s", (pvp, expected) => {
    expect(ids(fii({ pvp }))).toEqual(expected);
  });

  it("papel fala dos títulos, tijolo dos imóveis", () => {
    expect(radarFacts(fii({ pvp: 0.7, macro: "Papel" }))[0].text).toContain("títulos");
    expect(radarFacts(fii({ pvp: 0.7 }))[0].text).toContain("imóveis");
  });

  it("provento suspenso vem primeiro e substitui o 'menor que o de costume'", () => {
    expect(ids(fii({ pvp: 0.7, suspended: true, dividendRatio: 0.5 }))).toEqual([
      "suspenso",
      "pvp-bem-baixo",
    ]);
  });

  it.each([
    [0.89, ["provento-menor"]],
    [0.9, []],
  ])("último provento ÷ média %s", (dividendRatio, expected) => {
    expect(ids(fii({ dividendRatio }))).toEqual(expected);
  });

  it("prêmio: só o negativo vira fato (tijolo pela taxa real, papel descontando o IPCA)", () => {
    expect(ids(fii({ dy12m: 0.12, realRate: 0.07 }))).toEqual([]);
    expect(ids(fii({ dy12m: 0.06, realRate: 0.07 }))).toEqual(["premio-negativo"]);
    expect(ids(fii({ macro: "Papel", dy12m: 0.1, realRate: 0.07 }))).toEqual(["premio-negativo"]);
    expect(ids(fii({ macro: "Papel", dy12m: 0.12, realRate: 0.07 }))).toEqual([]);
  });

  it.each([
    [0.05, ["vacancia-baixa"]],
    [0.051, []],
    [0.099, []],
    [0.1, ["vacancia-alta"]],
  ])("vacância %s no tijolo", (vacancy, expected) => {
    expect(ids(fii({ vacancy }))).toEqual(expected);
  });

  it("vacância não vale para papel", () => {
    expect(ids(fii({ macro: "Papel", vacancy: 0.5 }))).toEqual([]);
  });
});

describe("radarFacts: ações", () => {
  it.each([
    [0.049, ["margem-baixa"]],
    [0.05, []],
    [0.15, ["margem-alta"]],
  ])("margem líquida %s", (netMargin, expected) => {
    expect(ids(stock({}, { netMargin }))).toEqual(expected);
  });

  it.each([
    [0.079, ["roe-baixo"]],
    [0.08, []],
    [0.15, ["roe-alto"]],
  ])("ROE %s", (roe, expected) => {
    expect(ids(stock({}, { roe }))).toEqual(expected);
  });

  it.each([
    [1.0, []],
    [1.01, ["divida-alta"]],
    [0.49, ["divida-baixa"]],
  ])("dívida/PL %s", (netDebtToEquity, expected) => {
    expect(ids(stock({}, { netDebtToEquity }))).toEqual(expected);
  });

  it.each([
    [-0.001, ["receita-caiu"]],
    [0, []],
    [0.1, ["receita-cresceu"]],
  ])("crescimento da receita %s", (revenueGrowth5y, expected) => {
    expect(ids(stock({}, { revenueGrowth5y }))).toEqual(expected);
  });

  it("os fatos de balanço dizem 'no último ano'", () => {
    const [fact] = radarFacts(stock({}, { netMargin: 0.003 }));
    expect(fact.text).toMatch(/^no último ano/);
  });

  it("prejuízo vem primeiro e tira margem e ROE (TUPY3)", () => {
    expect(
      ids(
        stock(
          { dividendsKnown: true, payments12m: 0 },
          { netIncome12m: -1, netMargin: 0.01, roe: -0.29, netDebtToEquity: 0.74 },
        ),
      ),
    ).toEqual(["prejuizo", "sem-dividendos"]);
  });

  it("banco (BBAS3): sem margem nem dívida; P/VP vale", () => {
    expect(
      ids(
        stock(
          {},
          {
            sector: "Intermediários Financeiros",
            subsector: "Bancos",
            pvp: 0.53,
            roe: 0.07,
            netDebtToEquity: 0.2,
            netMargin: 0.02,
          },
        ),
      ),
    ).toEqual(["roe-baixo", "pvp-banco-baixo"]);
  });

  it("seguradora (BBSE3): sem fato de P/VP", () => {
    expect(
      ids(
        stock(
          {},
          { sector: "Previdência e Seguros", subsector: "Seguradoras", pvp: 5.71, roe: 0.68 },
        ),
      ),
    ).toEqual(["roe-alto"]);
  });

  it("elétrica (EGIE3): sem fato de dívida", () => {
    expect(
      ids(
        stock(
          {},
          { sector: "Energia Elétrica", subsector: "Energia Elétrica", netDebtToEquity: 1.19 },
        ),
      ),
    ).toEqual([]);
  });

  it("dividendos: DY 8% com 2 pagamentos; um pagamento só não basta (UNIP6)", () => {
    expect(ids(stock({ dividendsKnown: true, dy12m: 0.08, payments12m: 2 }))).toEqual([
      "dividendos-bons",
    ]);
    expect(ids(stock({ dividendsKnown: true, dy12m: 0.24, payments12m: 1 }))).toEqual([]);
    expect(ids(stock({ dividendsKnown: true, dy12m: 0.079, payments12m: 4 }))).toEqual([]);
  });

  it("sem histórico de proventos buscado, nenhum fato de dividendo", () => {
    expect(ids(stock({ dividendsKnown: false, payments12m: 0 }))).toEqual([]);
  });

  it("sem indicadores do Fundamentus, só os fatos de dividendo", () => {
    expect(ids({ ...stock({ dividendsKnown: true, payments12m: 0 }), indicators: null })).toEqual([
      "sem-dividendos",
    ]);
  });
});

describe("radarFacts: fatos novos", () => {
  it.each([
    [[0.08, 0.09, 0.1], 0.12, ["dy-acima-pares"]],
    [[0.08, 0.09, 0.1], 0.07, ["dy-abaixo-pares"]],
    [[0.08, 0.09, 0.1], 0.095, []],
    [[0.08, 0.09], 0.12, []],
  ])("DY contra os pares %j, DY %s", (peerDy, dy12m, expected) => {
    expect(ids(fii({ peerDy, dy12m }))).toEqual(expected);
  });

  it("DY empatado com os pares não conta como acima", () => {
    expect(ids(fii({ peerDy: [0.1, 0.1, 0.1], dy12m: 0.1 }))).toEqual([]);
  });

  it.each([
    [1.05, ["proventos-subindo"]],
    [1.04, []],
    [0.91, []],
    [0.9, ["proventos-caindo"]],
  ])("tendência dos proventos %s", (dividendTrend, expected) => {
    expect(ids(fii({ dividendTrend }))).toEqual(expected);
  });

  it("'proventos-caindo' some quando já há corte ou suspensão", () => {
    expect(ids(fii({ dividendTrend: 0.8, dividendRatio: 0.5 }))).toEqual(["provento-menor"]);
    expect(ids(fii({ dividendTrend: 0.8, suspended: true }))).toEqual(["suspenso"]);
  });

  it.each([
    [{ monthChange: -0.08 }, ["preco-caiu-mes"]],
    [{ monthChange: -0.079 }, []],
    [{ monthChange: 0.08 }, ["preco-subiu-mes"]],
    [{ yearChange: -0.15 }, ["preco-caiu-ano"]],
    [{ yearChange: 0.2 }, ["preco-subiu-ano"]],
    [{ yearChange: 0.19 }, []],
  ])("preço %j", (over, expected) => {
    expect(ids(fii(over))).toEqual(expected);
    expect(ids(stock(over))).toEqual(expected);
  });

  it("os fatos de preço são neutros e sem termo", () => {
    const [fact] = radarFacts(fii({ monthChange: -0.2 }));
    expect(fact).toMatchObject({ tone: "neutral", term: null });
  });

  it("cada fato traz o termo que ele explica", () => {
    const termOf = (input: FiiRadarInput | StockRadarInput) =>
      radarFacts(input).map((f) => `${f.id}=${f.term}`);
    expect(termOf(fii({ pvp: 0.7, vacancy: 0.2, dy12m: 0.06, realRate: 0.07 }))).toEqual([
      "pvp-bem-baixo=pvp",
      "premio-negativo=tesouro-ipca",
      "vacancia-alta=vacancia",
    ]);
    expect(termOf(fii({ dividendRatio: 0.5 }))).toEqual(["provento-menor=rendimentos"]);
    expect(termOf(stock({}, { netIncome12m: -1 }))).toEqual(["prejuizo=lucro-liquido"]);
    expect(termOf(stock({}, { netMargin: 0.2, roe: 0.2, netDebtToEquity: 0.1 }))).toEqual([
      "margem-alta=margem-liquida",
      "roe-alto=roe",
      "divida-baixa=divida-liquida",
    ]);
  });
});

describe("describeAsset", () => {
  it.each([
    [{ segment: "Logística", fundType: "Tijolo" }, "um fundo imobiliário de galpões logísticos"],
    [{ segment: "Shoppings", fundType: "Híbrido" }, "um fundo imobiliário de shoppings"],
    [
      { segment: "Logística", fundType: "Papel" },
      "um fundo imobiliário de papel, que empresta dinheiro ao setor imobiliário",
    ],
    [
      { segment: "Multicategoria", fundType: "Tijolo" },
      "um fundo imobiliário dono de imóveis de vários tipos",
    ],
    [
      { segment: "Outros", fundType: "Fundo de Fundos" },
      "um fundo imobiliário que investe em outros fundos imobiliários",
    ],
    [{ segment: null, fundType: "Fiagro" }, "um fundo do agronegócio"],
    [{ segment: null, fundType: null }, "um fundo imobiliário"],
  ])("FII %j", (over, expected) => {
    expect(describeAsset(fii(over))).toBe(expected);
  });

  it("ações pelo subsetor e pelo setor", () => {
    expect(
      describeAsset(stock({}, { sector: "Intermediários Financeiros", subsector: "Bancos" })),
    ).toBe("um banco");
    expect(
      describeAsset(stock({}, { sector: "Previdência e Seguros", subsector: "Seguradoras" })),
    ).toBe("uma seguradora");
    expect(describeAsset(stock({}, { sector: "Mineração", subsector: "Minerais Metálicos" }))).toBe(
      "uma empresa do setor de mineração",
    );
    expect(describeAsset(stock({ indicators: null }))).toBe("uma empresa da bolsa");
  });
});

describe("dividendTrend e monthChange", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  const monthsAgo = (m: number) => new Date(now.getTime() - m * 30.4 * 86_400_000);
  const monthly = (values: number[]) =>
    values.map((perShare, i) => ({ exDate: monthsAgo(i + 0.5), perShare }));

  it("média por pagamento: 6 recentes contra 6 antigos", () => {
    const recent = Array(6).fill(1.1);
    const old = Array(6).fill(1);
    expect(dividendTrend(monthly([...recent, ...old]), now)).toBeCloseTo(1.1);
  });

  it("6 contra 5 pagamentos iguais dão 1 (a contagem não pesa)", () => {
    expect(dividendTrend(monthly(Array(11).fill(1)), now)).toBeCloseTo(1);
  });

  it("menos de 4 pagamentos numa metade: null", () => {
    expect(dividendTrend(monthly([1, 1, 1, 1, 1, 1, 1, 1, 1]), now)).toBeNull();
    expect(dividendTrend([], now)).toBeNull();
  });

  it("monthChange: o fechamento mais recente com 28 dias ou mais", () => {
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
    const closes = [
      { date: daysAgo(31), close: 90 },
      { date: daysAgo(29), close: 100 },
      { date: daysAgo(10), close: 120 },
    ];
    expect(monthChange(110, closes, now)).toBeCloseTo(0.1);
    expect(monthChange(110, [{ date: daysAgo(10), close: 100 }], now)).toBeNull();
    expect(monthChange(null, closes, now)).toBeNull();
  });
});

describe("businessKind", () => {
  it.each([
    ["Intermediários Financeiros", "Bancos", "financial"],
    ["Previdência e Seguros", "Seguradoras", "financial"],
    ["Energia Elétrica", "Energia Elétrica", "regulated"],
    ["Água e Saneamento", "Água e Saneamento", "regulated"],
    ["Químicos", "Químicos Diversos", "general"],
    [null, null, "general"],
  ])("%s / %s → %s", (sector, subsector, kind) => {
    expect(businessKind(sector, subsector)).toBe(kind);
  });
});

describe("factsKey e needsRadar", () => {
  const now = new Date("2026-11-13T06:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

  it("a chave são os ids em ordem", () => {
    expect(factsKey(radarFacts(fii({ pvp: 0.7, vacancy: 0.2 })))).toBe(
      "pvp-bem-baixo|vacancia-alta",
    );
  });

  it("regerar só com chave nova (ou falha) e mais de 20 h", () => {
    const ok = { factsKey: "a", status: "ok" as const, generatedAt: hoursAgo(21) };
    expect(needsRadar(null, "a", now)).toBe(true);
    expect(needsRadar(ok, "a", now)).toBe(false);
    expect(needsRadar({ ...ok, generatedAt: hoursAgo(19) }, "b", now)).toBe(false);
    expect(needsRadar(ok, "b", now)).toBe(true);
    expect(needsRadar({ ...ok, status: "failed" }, "a", now)).toBe(true);
    expect(needsRadar({ ...ok, status: "failed", generatedAt: hoursAgo(2) }, "a", now)).toBe(false);
  });

  it("mesma chave: renova um dia antes de o texto sumir (staleDays - 1)", () => {
    const ok = { factsKey: "a", status: "ok" as const };
    expect(needsRadar({ ...ok, generatedAt: hoursAgo(8 * 24) }, "a", now)).toBe(false);
    expect(needsRadar({ ...ok, generatedAt: hoursAgo(9 * 24) }, "a", now)).toBe(true);
  });
});

describe("validateRadarText", () => {
  const good =
    "Quase todos os imóveis estão alugados, mas o último pagamento veio menor que o de costume.";

  it("aceita texto válido, aparado", () => {
    expect(validateRadarText(`  ${good}\n`, "STOP")).toBe(good);
  });

  it("jargão por palavra inteira, sem acento nem caixa", () => {
    expect(validateRadarText("A inflação pode corroer a renda do fundo.", "STOP")).not.toBeNull();
    expect(validateRadarText("A VACÂNCIA do fundo subiu.", "STOP")).toBeNull();
  });

  it.each([
    ["MAX_TOKENS", good],
    ["STOP", ""],
    ["STOP", "A empresa é negociada acima do"],
    ["STOP", "O fundo paga 9% ao ano."],
    ["STOP", "O p/vp do fundo está baixo."],
    ["STOP", "A vacância está baixa."],
    ["STOP", "Uma frase. Outra frase. Mais uma."],
    ["STOP", `${"palavra ".repeat(60).trim()}.`],
  ])("recusa (%s) %s", (finish, text) => {
    expect(validateRadarText(text, finish)).toBeNull();
  });

  it("os exemplos do prompt passam na validação", () => {
    for (const example of RADAR_EXAMPLES) {
      expect(validateRadarText(example.text, "STOP")).toBe(example.text);
    }
  });
});

describe("buildRadarPrompt", () => {
  const prompt = buildRadarPrompt("FII", radarFacts(fii({ pvp: 0.7, vacancy: 0.2 })));

  it("leva os fatos com o sentido e os 4 exemplos", () => {
    expect(prompt).toContain(
      "(favorável) o preço na bolsa está abaixo do que os imóveis do fundo valem",
    );
    expect(prompt).toContain("(desfavorável) uma parte relevante dos imóveis está vazia");
    for (const example of RADAR_EXAMPLES) expect(prompt).toContain(example.text);
  });

  it("não leva números nem dados da carteira", () => {
    expect(prompt).not.toMatch(/\d/);
    expect(prompt).not.toMatch(/teto|preço médio|quantidade|rank/i);
  });
});

describe("radarChips", () => {
  it("FII de tijolo: P/VP, DY, FFO Yield, Cap Rate, Vacância; ausentes fora", () => {
    const chips = radarChips({
      kind: "FII",
      macro: "Tijolo",
      pvp: 0.88,
      dy12m: 0.092,
      vacancy: 0.02,
      indicators: {
        kind: "FII",
        ffoYield: 0.0763,
        capRate: null,
        propertyCount: 37,
        quarterlyReport: null,
      },
    });
    expect(chips.map((chip) => `${chip.label} ${chip.value}`)).toEqual([
      "P/VP 0,88",
      "DY 9,2%",
      "FFO Yield 7,6%",
      "Vacância 2,0%",
    ]);
    expect(chips.every((chip) => chip.help.length > 0)).toBe(true);
  });

  it("ação: P/L, P/VP, ROE, Margem líq., Dív. líq./PL", () => {
    const chips = radarChips({
      kind: "ACAO",
      indicators: indicators({
        pl: 22.06,
        pvp: 2.94,
        roe: 0.133,
        netMargin: 0.05,
        netDebtToEquity: 1.17,
      }),
    });
    expect(chips.map((chip) => chip.label)).toEqual([
      "P/L",
      "P/VP",
      "ROE",
      "Margem líq.",
      "Dív. líq./PL",
    ]);
  });
});

describe("constantes", () => {
  it("o IPCA assumido é o mesmo do teto calculado", () => {
    expect(RADAR.assumedInflation).toBe(CEILING_CHECK.assumedInflation);
  });
});

describe("radarSources", () => {
  const now = new Date("2026-11-12T12:00:00Z");
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

  it("corta os proventos em 10 dias", () => {
    const base = {
      dy12m: 0.1,
      dividendPayments12m: 12,
      lastDividend: { amount: 1, exDate: daysAgo(5) },
    };
    const fresh = radarSources({ ...base, dividendsFetchedAt: daysAgo(10) }, now);
    expect(fresh.dy12m).toBe(0.1);
    expect(fresh.daysSinceLastDividend).toBe(5);
    const stale = radarSources({ ...base, dividendsFetchedAt: daysAgo(11) }, now);
    expect(stale).toMatchObject({ dy12m: null, payments12m: null, daysSinceLastDividend: null });
    expect(stale.dividendsKnown).toBe(false);
  });

  it("corta P/VP e vacância em 60 dias e dá a vacância em fração", () => {
    const doc = { priceToBook: 0.9, vacancyPct: 7 };
    const fresh = radarSources({ ...doc, fundamentalsFetchedAt: daysAgo(60) }, now);
    expect(fresh.pvp).toBe(0.9);
    expect(fresh.vacancy).toBeCloseTo(0.07);
    const stale = radarSources({ ...doc, fundamentalsFetchedAt: daysAgo(61) }, now);
    expect(stale.pvp).toBeNull();
    expect(stale.vacancy).toBeNull();
  });

  it("indicadores do Fundamentus com mais de 10 dias viram null", () => {
    const stock = { kind: "ACAO", fetchedAt: daysAgo(3) } as StockIndicators & { fetchedAt: Date };
    expect(radarSources({ fundamentusIndicators: stock }, now).stockIndicators).toBe(stock);
    expect(radarSources({ fundamentusIndicators: stock }, now).fiiIndicators).toBeNull();
    const old = { ...stock, fetchedAt: daysAgo(11) };
    expect(radarSources({ fundamentusIndicators: old }, now).stockIndicators).toBeNull();
  });

  it("sem dados, tudo ausente", () => {
    expect(radarSources({}, now)).toMatchObject({
      pvp: null,
      vacancy: null,
      dy12m: null,
      dividendsKnown: false,
    });
  });
});
