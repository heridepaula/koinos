import { describe, expect, it } from "vitest";
import { CEILING_CHECK } from "@/features/strategy";
import {
  BANK_DESCRIPTION,
  buildRadarPrompt,
  businessKind,
  describeAsset,
  dividendTrend,
  factsKey,
  monthChange,
  needsRadar,
  normalizeForDuplicate,
  promptTerms,
  RADAR,
  RADAR_EXAMPLES,
  radarChips,
  radarFacts,
  radarSources,
  radarTerms,
  validateRadarText,
  type FiiRadarInput,
  type StockRadarInput,
} from "./radar";
import { glossaryEntry, glossaryIdsIn } from "@/shared/lib/glossary";
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

  it("'proventos-subindo' some com suspensão ou corte", () => {
    expect(ids(fii({ dividendTrend: 1.2, suspended: true }))).toEqual(["suspenso"]);
    expect(ids(fii({ dividendTrend: 1.2, dividendRatio: 0.5 }))).toEqual(["provento-menor"]);
  });

  it("DY contra 4 pares: quartil superior", () => {
    expect(ids(fii({ peerDy: [0.08, 0.09, 0.1, 0.13], dy12m: 0.12 }))).toEqual(["dy-acima-pares"]);
  });

  it("todo fato tem termo que o glossário resolve e os ids esperados são todos cobertos", () => {
    const bank = { sector: "Intermediários Financeiros", subsector: "Bancos" };
    const all = [
      ...[0.7, 0.8, 1.1, 1.3].flatMap((pvp) => radarFacts(fii({ pvp }))),
      ...radarFacts(fii({ suspended: true })),
      ...radarFacts(fii({ dividendRatio: 0.5 })),
      ...radarFacts(fii({ dividendTrend: 1.2 })),
      ...radarFacts(fii({ dividendTrend: 0.8 })),
      ...radarFacts(fii({ dy12m: 0.06, realRate: 0.07 })),
      ...radarFacts(fii({ peerDy: [0.08, 0.09, 0.1, 0.13], dy12m: 0.12 })),
      ...radarFacts(fii({ peerDy: [0.08, 0.09, 0.1, 0.13], dy12m: 0.07 })),
      ...radarFacts(fii({ vacancy: 0.02 })),
      ...radarFacts(fii({ vacancy: 0.2 })),
      ...radarFacts(fii({ monthChange: -0.2, yearChange: -0.3 })),
      ...radarFacts(fii({ monthChange: 0.2, yearChange: 0.4 })),
      ...radarFacts(stock({}, { netIncome12m: -1 })),
      ...radarFacts(
        stock({}, { netMargin: 0.01, roe: 0.01, netDebtToEquity: 2, revenueGrowth5y: -0.1 }),
      ),
      ...radarFacts(
        stock({}, { netMargin: 0.3, roe: 0.3, netDebtToEquity: 0.1, revenueGrowth5y: 0.3 }),
      ),
      ...radarFacts(stock({}, { ...bank, pvp: 0.5 })),
      ...radarFacts(stock({}, { ...bank, pvp: 2 })),
      ...radarFacts(stock({ dividendsKnown: true, payments12m: 0 })),
      ...radarFacts(stock({ dividendsKnown: true, dy12m: 0.1, payments12m: 4 })),
    ];
    const expected = [
      "pvp-bem-baixo",
      "pvp-baixo",
      "pvp-alto",
      "pvp-bem-alto",
      "suspenso",
      "provento-menor",
      "proventos-subindo",
      "proventos-caindo",
      "premio-negativo",
      "dy-acima-pares",
      "dy-abaixo-pares",
      "vacancia-baixa",
      "vacancia-alta",
      "prejuizo",
      "margem-baixa",
      "margem-alta",
      "roe-alto",
      "roe-baixo",
      "divida-alta",
      "divida-baixa",
      "receita-caiu",
      "receita-cresceu",
      "pvp-banco-baixo",
      "pvp-banco-alto",
      "sem-dividendos",
      "dividendos-bons",
      "preco-caiu-mes",
      "preco-subiu-mes",
      "preco-caiu-ano",
      "preco-subiu-ano",
    ];
    expect(new Set(all.map((f) => f.id))).toEqual(new Set(expected));
    for (const f of all) if (f.term !== null) expect(glossaryEntry(f.term)).toBeDefined();
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
    [
      { segment: null, fundType: null, macro: "Papel" as const },
      "um fundo imobiliário de papel, que empresta dinheiro ao setor imobiliário",
    ],
  ])("FII %j", (over, expected) => {
    expect(describeAsset(fii(over))).toBe(expected);
  });

  it("ações pelo subsetor e pelo setor", () => {
    expect(
      describeAsset(stock({}, { sector: "Intermediários Financeiros", subsector: "Bancos" })),
    ).toBe(BANK_DESCRIPTION);
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
    expect(validateRadarText(`  ${good}\n`, "STOP", "FII")).toBe(good);
  });

  it("aceita termos do glossário, com ou sem acento e caixa", () => {
    expect(validateRadarText("A VACÂNCIA do fundo subiu.", "STOP", "FII")).not.toBeNull();
    expect(validateRadarText("O P/VP do fundo está baixo.", "STOP", "FII")).not.toBeNull();
    expect(validateRadarText("O dividend yield da empresa é alto.", "STOP", "ACAO")).not.toBeNull();
  });

  it.each([
    ["MAX_TOKENS", good],
    ["STOP", ""],
    ["STOP", "A empresa é negociada acima do"],
    ["STOP", "O fundo paga 9% ao ano."],
    ["STOP", "O EBITDA da empresa caiu."],
    ["STOP", "O yield do fundo caiu."],
    ["STOP", "Uma frase. Outra frase. Mais uma. E outra."],
    ["STOP", `${"palavra ".repeat(80).trim()}.`],
    ["STOP", "O P/VP, o FFO, o cap rate e a vacância mudaram."],
  ])("recusa (%s) %s", (finish, text) => {
    expect(validateRadarText(text, finish, "FII")).toBeNull();
  });

  it("termo de outra classe é jargão: ROE num FII", () => {
    expect(validateRadarText("O ROE do fundo caiu.", "STOP", "FII")).toBeNull();
  });

  it("termos comuns não contam no limite", () => {
    const text = "A cota, os rendimentos e os proventos: o P/VP, o FFO e a vacância mudaram.";
    expect(validateRadarText(text, "STOP", "FII")).not.toBeNull();
  });

  it("os exemplos do prompt passam e usam de 1 a 3 termos", () => {
    for (const example of RADAR_EXAMPLES) {
      expect(validateRadarText(example.text, "STOP", example.kind)).toBe(example.text);
      const used = glossaryIdsIn(example.text, example.kind).length;
      expect(used).toBeGreaterThanOrEqual(1);
    }
    const firstWords = RADAR_EXAMPLES.map((e) => e.text.split(" ")[0]);
    expect(new Set(firstWords).size).toBe(firstWords.length);
  });
});

describe("promptTerms e radarTerms", () => {
  const facts = radarFacts(fii({ pvp: 0.7, vacancy: 0.2, dividendRatio: 0.5 }));

  it("os termos dos fatos, distintos, na ordem", () => {
    expect(promptTerms(facts, [])).toEqual(["pvp", "rendimentos", "vacancia"]);
  });

  it("o termo único dos 2 últimos textos vai para o fim", () => {
    expect(promptTerms(facts, [["pvp"], ["pvp"]])).toEqual(["rendimentos", "vacancia", "pvp"]);
    expect(promptTerms(facts, [["pvp"], ["vacancia"]])).toEqual(["pvp", "rendimentos", "vacancia"]);
  });

  it("radarTerms tira os comuns", () => {
    expect(radarTerms("A cota tem P/VP baixo e vacância alta.", "FII")).toEqual([
      "pvp",
      "vacancia",
    ]);
  });

  it("normalizeForDuplicate ignora caixa, acento e pontuação", () => {
    expect(normalizeForDuplicate("O fundo, hoje, PAGA bem.")).toBe(
      normalizeForDuplicate("o fundo hoje paga bem"),
    );
  });
});

describe("buildRadarPrompt", () => {
  const facts = radarFacts(fii({ pvp: 0.7, vacancy: 0.2 }));
  const prompt = buildRadarPrompt({
    kind: "FII",
    description: "um fundo imobiliário de galpões logísticos",
    facts,
    recentTerms: [],
  });

  it("leva a descrição, os fatos com o termo, a lista de termos e os 4 exemplos", () => {
    expect(prompt).toContain("como está agora um fundo imobiliário de galpões logísticos");
    expect(prompt).toContain(
      "(favorável) o preço na bolsa está bem abaixo do que os imóveis do fundo valem [termo: P/VP]",
    );
    expect(prompt).toContain(
      "Termos do mercado que você pode usar (no máximo dois, escritos igual): P/VP, vacância",
    );
    for (const example of RADAR_EXAMPLES) expect(prompt).toContain(example.text);
  });

  it("sem termos, proíbe siglas", () => {
    const plainPrompt = buildRadarPrompt({
      kind: "FII",
      description: "um fundo imobiliário",
      facts: radarFacts(fii({ monthChange: -0.2 })),
      recentTerms: [],
    });
    expect(plainPrompt).not.toContain("Termos do mercado que você pode usar");
    expect(plainPrompt).toContain("Sem siglas nem termos técnicos de investimento.");
  });

  it("com texto a evitar, pede outra abertura", () => {
    const again = buildRadarPrompt({
      kind: "FII",
      description: "x",
      facts,
      recentTerms: [],
      avoid: "Texto igual.",
    });
    expect(again).toContain("Outro ativo já tem este texto: «Texto igual.»");
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
    expect(chips[0].help).toBe(glossaryEntry("pvp")?.definition);
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
      dividendTrend: null,
      monthChange: null,
    });
  });
});
