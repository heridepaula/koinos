import { describe, expect, it } from "vitest";
import { CEILING_CHECK } from "@/features/strategy";
import {
  buildRadarPrompt,
  businessKind,
  factsKey,
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
  pvp: null,
  dividendRatio: null,
  suspended: false,
  dy12m: null,
  realRate: null,
  vacancy: null,
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
    ...over,
  };
};

const ids = (input: FiiRadarInput | StockRadarInput) => radarFacts(input).map((fact) => fact.id);

describe("radarFacts: FIIs", () => {
  it.each([
    [0.84, ["pvp-baixo"]],
    [0.85, []],
    [1.05, []],
    [1.06, ["pvp-alto"]],
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
      "pvp-baixo",
    ]);
  });

  it.each([
    [0.89, ["provento-menor"]],
    [0.9, []],
  ])("último provento ÷ média %s", (dividendRatio, expected) => {
    expect(ids(fii({ dividendRatio }))).toEqual(expected);
  });

  it("prêmio sobre a NTN-B: tijolo pela taxa real, papel descontando o IPCA assumido", () => {
    // 0,08 − 0,07 = 1 p.p. no tijolo
    expect(ids(fii({ dy12m: 0.08, realRate: 0.07 }))).toEqual(["premio-alto"]);
    // papel: 0,12 − (0,07 + 0,04) = 1 p.p.
    expect(ids(fii({ macro: "Papel", dy12m: 0.12, realRate: 0.07 }))).toEqual(["premio-alto"]);
    // papel: 0,10 − 0,11 < 0
    expect(ids(fii({ macro: "Papel", dy12m: 0.1, realRate: 0.07 }))).toEqual(["premio-negativo"]);
    // sem taxa, sem fato
    expect(ids(fii({ dy12m: 0.2 }))).toEqual([]);
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
    expect(factsKey(radarFacts(fii({ pvp: 0.7, vacancy: 0.2 })))).toBe("pvp-baixo|vacancia-alta");
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
