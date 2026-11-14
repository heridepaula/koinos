import { describe, expect, it } from "vitest";
import type { RadarFact, RadarInput } from "./radar";
import type { WeekSummary } from "./week-summary";
import {
  buildThesisPrompt,
  factNumber,
  groupLenses,
  lensToneOf,
  methodLensTone,
  methodSignals,
  needsThesis,
  checkThesis,
  parseThesis,
  THESIS,
  thesisEvidence,
  thesisFromReading,
  thesisKey,
  thesisSchema,
  thesisView,
  weekEvidence,
  type ThesisEvidence,
  type ThesisTarget,
} from "./asset-thesis";

const target = (over: Partial<ThesisTarget> = {}): ThesisTarget => ({
  rank: 3,
  rankCount: 24,
  ceiling: 100,
  bias: null,
  ...over,
});
const ids = (list: { id: string }[]) => list.map((e) => e.id);
const byId = (list: { id: string; text: string; tone: string }[], id: string) =>
  list.find((e) => e.id === id);

describe("methodSignals", () => {
  it("sem alvo não há sinal", () => {
    expect(methodSignals({ kind: "FII", target: null, price: 90, suspended: false })).toEqual([]);
  });

  it("rank em três terços", () => {
    const at = (rank: number) =>
      byId(
        methodSignals({
          kind: "FII",
          target: target({ rank, rankCount: 9 }),
          price: 80,
          suspended: false,
        }),
        "metodo-rank",
      );
    expect(at(1)).toMatchObject({
      tone: "favoravel",
      text: "1º do ranking de 9 FIIs (entre os primeiros)",
    });
    expect(at(3)).toMatchObject({ tone: "favoravel" });
    expect(at(4)).toMatchObject({ tone: "neutro", text: "4º do ranking de 9 FIIs (no meio)" });
    expect(at(7)).toMatchObject({
      tone: "neutro",
      text: "7º do ranking de 9 FIIs (entre os últimos)",
    });
  });

  it("faixas do teto do FII pela distância (teto − preço) ÷ teto", () => {
    const at = (price: number) =>
      byId(
        methodSignals({ kind: "FII", target: target(), price, suspended: false }),
        "metodo-teto",
      );
    expect(at(95.1)).toMatchObject({
      tone: "neutro",
      text: "preço 5% abaixo do teto do método (perto do teto)",
    });
    expect(at(95)).toMatchObject({
      tone: "favoravel",
      text: "preço 5% abaixo do teto do método (abaixo do teto)",
    });
    expect(at(85.1)).toMatchObject({
      tone: "favoravel",
      text: "preço 15% abaixo do teto do método (abaixo do teto)",
    });
    expect(at(85)).toMatchObject({
      tone: "favoravel",
      text: "preço 15% abaixo do teto do método (bem abaixo do teto)",
    });
    expect(at(110)).toMatchObject({
      tone: "desfavoravel",
      text: "preço 10% acima do teto do método",
    });
  });

  it("ação usa a margem de segurança (teto ÷ preço − 1)", () => {
    const list = methodSignals({
      kind: "ACAO",
      target: target({ ceiling: 12, rankCount: 10 }),
      price: 10,
      suspended: false,
    });
    expect(byId(list, "metodo-margem")).toMatchObject({
      tone: "favoravel",
      text: "margem de segurança de 20% até o teto do método (alta)",
    });
    expect(byId(list, "metodo-rank")?.text).toBe("3º do ranking de 10 ações (entre os primeiros)");
    expect(ids(list)).not.toContain("metodo-teto");
  });

  it("viés", () => {
    const comprar = methodSignals({
      kind: "FII",
      target: target({ bias: "COMPRAR" }),
      price: 80,
      suspended: false,
    });
    expect(byId(comprar, "metodo-vies")).toMatchObject({
      tone: "favoravel",
      text: "viés Comprar no método",
    });
    const aguardar = methodSignals({
      kind: "FII",
      target: target({ bias: "AGUARDAR" }),
      price: 80,
      suspended: false,
    });
    expect(byId(aguardar, "metodo-vies")).toMatchObject({ tone: "desfavoravel" });
  });

  it("cada motivo de fora da fila, na ordem do motor", () => {
    const fora = (
      t: Partial<ThesisTarget>,
      price: number | null,
      suspended = false,
      kind: "FII" | "ACAO" = "FII",
    ) =>
      byId(methodSignals({ kind, target: target(t), price, suspended }), "metodo-fora")?.text ??
      null;
    expect(fora({ rank: null }, 80)).toBe(
      "fora da fila de compra: o ativo não tem posição no ranking",
    );
    expect(fora({ ceiling: null }, 80)).toBe(
      "fora da fila de compra: o método não tem preço teto para o ativo",
    );
    expect(fora({}, 100)).toBe("fora da fila de compra: o preço chegou ao teto do método");
    expect(fora({ bias: "AGUARDAR" }, 80)).toBe("fora da fila de compra: o método marcou Aguardar");
    expect(fora({}, 80, true)).toBe("fora da fila de compra: o fundo parou de pagar rendimentos");
    expect(fora({}, 80, true, "ACAO")).toBeNull();
    expect(fora({}, 80)).toBeNull();
    expect(fora({}, null)).toBeNull();
  });
});

const fiiInput = (over: Partial<Extract<RadarInput, { kind: "FII" }>> = {}): RadarInput => ({
  kind: "FII",
  macro: "Tijolo",
  segment: "logistica",
  fundType: "tijolo",
  pvp: 0.82,
  dividendRatio: 0.85,
  suspended: false,
  dy12m: 0.102,
  realRate: 0.07,
  vacancy: 0.12,
  peerDy: [],
  dividendTrend: null,
  monthChange: -0.09,
  yearChange: -0.16,
  ...over,
});
const fact = (id: string): RadarFact => ({ id, text: "x", tone: "neutral", term: null });

describe("factNumber", () => {
  it("o número de cada fato do FII", () => {
    const input = fiiInput();
    expect(factNumber(fact("pvp-baixo"), input)).toBe("P/VP de 0,82");
    expect(factNumber(fact("provento-menor"), input)).toBe(
      "último pagamento 85% da média de 12 meses",
    );
    expect(factNumber(fact("dy-abaixo-pares"), input)).toBe("DY de 10,2% em 12 meses");
    expect(factNumber(fact("vacancia-alta"), input)).toBe("vacância de 12,0%");
    expect(factNumber(fact("preco-caiu-mes"), input)).toBe("−9% no mês");
    expect(factNumber(fact("preco-caiu-ano"), input)).toBe("−16% em 12 meses");
    expect(factNumber(fact("suspenso"), input)).toBeNull();
  });

  it("o número de cada fato da ação", () => {
    const input: RadarInput = {
      kind: "ACAO",
      business: "general",
      isBank: false,
      indicators: {
        kind: "ACAO",
        pl: 8,
        pvp: 1.1,
        roe: 0.18,
        netMargin: 0.21,
        netDebtToEquity: 0.35,
        revenueGrowth5y: 0.12,
        netIncome12m: 1,
        sector: "Mineração",
        subsector: "Minerais metálicos",
      } as never,
      dy12m: 0.09,
      payments12m: 4,
      dividendsKnown: true,
      monthChange: null,
      yearChange: null,
    };
    expect(factNumber(fact("roe-alto"), input)).toBe("ROE de 18,0%");
    expect(factNumber(fact("margem-alta"), input)).toBe("margem líquida de 21,0%");
    expect(factNumber(fact("divida-baixa"), input)).toBe("dívida líquida de 0,35 vez o patrimônio");
    expect(factNumber(fact("receita-cresceu"), input)).toBe("receita 12% maior que há cinco anos");
    expect(factNumber(fact("dividendos-bons"), input)).toBe("DY de 9,0% em 12 meses");
    expect(factNumber(fact("pvp-banco-alto"), input)).toBe("P/VP de 1,10");
    expect(factNumber(fact("prejuizo"), input)).toBeNull();
  });
});

const NOW = new Date("2026-11-13T15:00:00Z");
const week = (over: Partial<WeekSummary> = {}): WeekSummary => ({
  newsKey: "a",
  status: "ok",
  text: "A semana trouxe corte de rendimentos. O preço caiu.",
  sources: [],
  model: "m",
  generatedAt: new Date("2026-11-12T15:00:00Z"),
  attemptedAt: new Date("2026-11-12T15:00:00Z"),
  version: 2,
  tone: "desfavoravel",
  ...over,
});

describe("weekEvidence", () => {
  it("a primeira frase da leitura, com o sentido da semana", () => {
    expect(weekEvidence(week(), NOW)).toEqual({
      id: "semana",
      group: "semana",
      text: "A semana trouxe corte de rendimentos.",
      tone: "desfavoravel",
      key: "semana:desfavoravel",
    });
  });
  it("misto e sem fato viram neutro", () => {
    expect(weekEvidence(week({ tone: "misto" }), NOW)?.tone).toBe("neutro");
  });
  it("nada sem texto, fora do ok, de outra versão ou com mais de 7 dias", () => {
    expect(weekEvidence(null, NOW)).toBeNull();
    expect(weekEvidence(week({ text: null }), NOW)).toBeNull();
    expect(weekEvidence(week({ status: "failed" }), NOW)).toBeNull();
    expect(weekEvidence(week({ version: 1 }), NOW)).toBeNull();
    expect(weekEvidence(week({ generatedAt: new Date("2026-11-06T14:59:00Z") }), NOW)).toBeNull();
  });
});

describe("thesisEvidence e thesisKey", () => {
  const facts: RadarFact[] = [
    {
      id: "pvp-baixo",
      text: "o preço na bolsa está abaixo do que os imóveis do fundo valem",
      tone: "good",
      term: "pvp",
    },
    {
      id: "vacancia-alta",
      text: "uma parte relevante dos imóveis está vazia",
      tone: "bad",
      term: "vacancia",
    },
  ];
  const evidence = thesisEvidence({
    kind: "FII",
    target: target(),
    price: 80,
    input: fiiInput(),
    facts,
    week: week(),
    now: NOW,
  });

  it("método, fundamentos com número e semana, nesta ordem", () => {
    expect(ids(evidence)).toEqual([
      "metodo-rank",
      "metodo-teto",
      "pvp-baixo",
      "vacancia-alta",
      "semana",
    ]);
    expect(byId(evidence, "pvp-baixo")).toMatchObject({
      group: "fundamento",
      tone: "favoravel",
      text: "o preço na bolsa está abaixo do que os imóveis do fundo valem (P/VP de 0,82)",
    });
    expect(byId(evidence, "vacancia-alta")?.tone).toBe("desfavoravel");
  });

  it("a chave usa a faixa, não o número", () => {
    const other = thesisEvidence({
      kind: "FII",
      target: target(),
      price: 79,
      input: fiiInput({ pvp: 0.8 }),
      facts,
      week: week(),
      now: NOW,
    });
    expect(thesisKey(other)).toBe(thesisKey(evidence));
    const near = thesisEvidence({
      kind: "FII",
      target: target(),
      price: 97,
      input: fiiInput(),
      facts,
      week: week(),
      now: NOW,
    });
    expect(thesisKey(near)).not.toBe(thesisKey(evidence));
  });
});

describe("needsThesis", () => {
  const at = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);
  const ok = (over: object = {}) => ({
    version: THESIS.version,
    factsKey: "k",
    status: "ok" as const,
    generatedAt: at(60),
    ...over,
  });
  it("sem tese", () => expect(needsThesis(null, "k", NOW)).toBe(true));
  it("v1 só depois de 60 min", () => {
    expect(needsThesis(ok({ version: undefined, generatedAt: at(59) }), "k", NOW)).toBe(false);
    expect(needsThesis(ok({ version: undefined, generatedAt: at(60) }), "k", NOW)).toBe(true);
  });
  it("chave nova refaz na hora", () =>
    expect(needsThesis(ok({ generatedAt: at(1) }), "outra", NOW)).toBe(true));
  it("falha depois de 60 min", () => {
    expect(needsThesis(ok({ status: "failed", generatedAt: at(59) }), "k", NOW)).toBe(false);
    expect(needsThesis(ok({ status: "failed", generatedAt: at(60) }), "k", NOW)).toBe(true);
  });
  it("ok igual depois de 20 h (o texto tem números)", () => {
    expect(needsThesis(ok({ generatedAt: at(20 * 60 - 1) }), "k", NOW)).toBe(false);
    expect(needsThesis(ok({ generatedAt: at(20 * 60) }), "k", NOW)).toBe(true);
  });
});

const ev = (
  id: string,
  group: ThesisEvidence["group"],
  tone: ThesisEvidence["tone"],
  text = id,
): ThesisEvidence => ({ id, group, tone, text, key: id });
const EVIDENCE: ThesisEvidence[] = [
  ev("metodo-rank", "metodo", "favoravel", "3º do ranking de 24 FIIs (entre os primeiros)"),
  ev(
    "metodo-teto",
    "metodo",
    "favoravel",
    "preço 18% abaixo do teto do método (bem abaixo do teto)",
  ),
  ev(
    "pvp-baixo",
    "fundamento",
    "favoravel",
    "o preço na bolsa está abaixo do que os imóveis do fundo valem (P/VP de 0,82)",
  ),
  ev(
    "vacancia-alta",
    "fundamento",
    "desfavoravel",
    "uma parte relevante dos imóveis está vazia (vacância de 12,0%)",
  ),
];
const PROMPT = buildThesisPrompt({
  kind: "FII",
  description: "um fundo imobiliário de galpões logísticos",
  evidence: EVIDENCE,
  terms: ["P/VP", "vacância"],
});

const answer = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    lentes: [
      {
        lente: "imoveis",
        observacao: "Uma parte dos galpões está vazia.",
        evidencias: ["vacancia-alta"],
      },
      {
        lente: "metodo",
        observacao: "O método põe o fundo entre os primeiros.",
        evidencias: ["metodo-rank"],
      },
    ],
    sintese: {
      motivo_da_fila: ["metodo-rank", "metodo-teto"],
      ponto_de_atencao: ["vacancia-alta"],
    },
    frases: [
      {
        texto: "O fundo está entre os primeiros do método e 18% abaixo do teto, com P/VP de 0,82.",
        evidencias: ["metodo-teto", "pvp-baixo"],
      },
      {
        texto: "O ponto de atenção é a vacância de 12,0%, com parte dos galpões vazia.",
        evidencias: ["vacancia-alta"],
      },
    ],
    ...over,
  });
const parse = (raw: string, finish = "STOP", evidence = EVIDENCE, prompt = PROMPT) =>
  parseThesis(raw, finish, { kind: "FII", evidence, prompt });
const sentence = (texto: string, evidencias: string[]) => ({ texto, evidencias });

describe("buildThesisPrompt", () => {
  it("evidências com id dentro de <dados>, lentes e passos, sem dado da carteira", () => {
    const dados = PROMPT.slice(PROMPT.indexOf("<dados>"), PROMPT.indexOf("</dados>"));
    expect(dados).toContain("- [metodo-teto] (favorável) preço 18% abaixo do teto do método");
    expect(dados).toContain("- [vacancia-alta] (desfavorável)");
    expect(PROMPT).toContain("imoveis (lente de Baroni");
    expect(PROMPT).toContain("motivo_da_fila");
    expect(PROMPT).toMatch(/P\/VP, vacância/);
    for (const word of ["quantidade", "preço médio", "aporte de R$", "meta"]) {
      expect(PROMPT.toLowerCase()).not.toContain(word);
    }
  });
});

describe("thesisSchema", () => {
  it("lentes, síntese e frases, nesta ordem, com as lentes da classe", () => {
    const schema = thesisSchema("ACAO") as {
      properties: Record<string, { items?: { properties: { lente?: { enum: string[] } } } }>;
    };
    expect(Object.keys(schema.properties)).toEqual(["lentes", "sintese", "frases"]);
    expect(schema.properties.lentes.items?.properties.lente?.enum).toEqual([
      "dividendos",
      "negocio",
      "risco",
      "metodo",
    ]);
  });
});

describe("parseThesis", () => {
  it("aceita a resposta boa e descarta a lente inválida", () => {
    const reading = parse(
      answer({
        lentes: [...JSON.parse(answer()).lentes, { lente: "x", observacao: "y.", evidencias: [] }],
      }),
    );
    expect(reading?.sentences.map((s) => s.evidence)).toEqual([
      ["metodo-teto", "pvp-baixo"],
      ["vacancia-alta"],
    ]);
    expect(reading?.lenses.map((l) => l.id)).toEqual(["imoveis", "metodo"]);
  });
  it.each([
    ["sem STOP", answer(), "MAX_TOKENS"],
    ["JSON inválido", "{", "STOP"],
    ["sem frases", answer({ frases: [] }), "STOP"],
  ])("recusa %s", (_, raw, finish) => expect(parse(raw, finish)).toBeNull());
  it("recusa 4 frases", () => {
    const one = sentence("A vacância de 12,0% pesa.", ["vacancia-alta"]);
    const raw = answer({
      frases: [
        sentence("O fundo está 18% abaixo do teto, com P/VP de 0,82.", [
          "metodo-teto",
          "pvp-baixo",
        ]),
        one,
        one,
        one,
      ],
    });
    expect(parse(raw)).toBeNull();
  });
  it("recusa frase sem id válido", () => {
    const raw = answer({
      frases: [
        sentence("O fundo está 18% abaixo do teto, com P/VP de 0,82.", [
          "metodo-teto",
          "pvp-baixo",
        ]),
        sentence("A vacância pesa.", ["inventado"]),
      ],
    });
    expect(parse(raw)).toBeNull();
  });
  it("recusa veredito sem método havendo sinais, e sem fundamento", () => {
    const noMethod = answer({
      frases: [
        sentence("O P/VP de 0,82 mostra desconto, mas a vacância de 12,0% pesa.", [
          "pvp-baixo",
          "vacancia-alta",
        ]),
      ],
    });
    expect(parse(noMethod)).toBeNull();
    const noFundamental = answer({
      frases: [
        sentence("O fundo está 18% abaixo do teto, mas a vacância de 12,0% pesa.", ["metodo-teto"]),
        sentence("A vacância pesa.", ["vacancia-alta"]),
      ],
    });
    expect(parse(noFundamental)).toBeNull();
  });
  it("aceita veredito só com fundamento quando não há sinais do método", () => {
    const evidence = EVIDENCE.filter((e) => e.group !== "metodo");
    const prompt = buildThesisPrompt({ kind: "FII", description: "um fundo", evidence, terms: [] });
    const raw = answer({
      frases: [
        sentence("O P/VP de 0,82 mostra desconto, mas a vacância de 12,0% pesa.", [
          "pvp-baixo",
          "vacancia-alta",
        ]),
      ],
    });
    expect(parse(raw, "STOP", evidence, prompt)).not.toBeNull();
  });
  it("recusa esconder a evidência desfavorável", () => {
    const raw = answer({
      frases: [
        sentence("O fundo está 18% abaixo do teto, com P/VP de 0,82.", [
          "metodo-teto",
          "pvp-baixo",
        ]),
      ],
    });
    expect(parse(raw)).toBeNull();
  });
  it("recusa número fora dos dados, frase banida, sem acento e jargão", () => {
    const bad = (texto: string) =>
      parse(answer({ frases: [sentence(texto, ["metodo-teto", "pvp-baixo", "vacancia-alta"])] }));
    expect(
      bad("O fundo está 25% abaixo do teto, com P/VP de 0,82, mas a vacância pesa."),
    ).toBeNull();
    expect(
      bad("É uma oportunidade: P/VP de 0,82 e 18% abaixo do teto, mas a vacância pesa."),
    ).toBeNull();
    expect(
      bad("O fundo esta 18% abaixo do teto e o preco tem P/VP de 0,82, mas a vacância pesa."),
    ).toBeNull();
    expect(
      bad("O fundo está 18% abaixo do teto, com EBITDA forte e P/VP de 0,82, mas a vacância pesa."),
    ).toBeNull();
  });
  it("recusa mais de 520 caracteres", () => {
    const long = `O fundo está 18% abaixo do teto, com P/VP de 0,82, mas a vacância pesa ${"muito ".repeat(80)}.`;
    expect(
      parse(answer({ frases: [sentence(long, ["metodo-teto", "pvp-baixo", "vacancia-alta"])] })),
    ).toBeNull();
  });
});

describe("checkThesis", () => {
  const reason = (raw: string, finish = "STOP") => {
    const result = checkThesis(raw, finish, { kind: "FII", evidence: EVIDENCE, prompt: PROMPT });
    return "rejection" in result ? result.rejection : null;
  };
  const one = (texto: string, evidencias: string[]) =>
    reason(answer({ frases: [sentence(texto, evidencias)] }));
  const all = ["metodo-teto", "pvp-baixo", "vacancia-alta"];
  it("devolve a resposta boa sem motivo", () => expect(reason(answer())).toBeNull());
  it.each([
    ["corte", answer(), "MAX_TOKENS"],
    ["json", "{", "STOP"],
    ["frases", answer({ frases: [] }), "STOP"],
  ])("motivo %s", (expected, raw, finish) => expect(reason(raw, finish)).toBe(expected));
  it("motivo de cada regra das frases", () => {
    expect(one("O fundo está 18% abaixo do teto", all)).toBe("sem-pontuacao");
    expect(one("O fundo está 18% abaixo do teto, com P/VP de 0,82.", ["inventado"])).toBe(
      "sem-evidencia",
    );
    expect(
      one("O fundo está 25% abaixo do teto, com P/VP de 0,82, mas a vacância pesa.", all),
    ).toBe("numero-fora");
    expect(
      one("É uma oportunidade: P/VP de 0,82 e 18% abaixo do teto, mas a vacância pesa.", all),
    ).toBe("banida");
    expect(
      one(
        "O fundo está 18% abaixo do teto, com EBITDA forte e P/VP de 0,82, mas a vacância pesa.",
        all,
      ),
    ).toBe("jargao");
    expect(
      one(
        `O fundo está 18% abaixo do teto, com P/VP de 0,82, mas a vacância pesa ${"muito ".repeat(80)}.`,
        all,
      ),
    ).toBe("longo");
  });
  it("motivo do veredito e da evidência desfavorável", () => {
    expect(
      one("O P/VP de 0,82 mostra desconto, mas a vacância de 12,0% pesa.", [
        "pvp-baixo",
        "vacancia-alta",
      ]),
    ).toBe("veredito-sem-metodo");
    expect(
      one("O fundo está 18% abaixo do teto, mas a vacância de 12,0% pesa.", ["metodo-teto"]),
    ).toBe("veredito-sem-fundamento");
    expect(
      one("O fundo está 18% abaixo do teto, com P/VP de 0,82.", ["metodo-teto", "pvp-baixo"]),
    ).toBe("desfavoravel-ausente");
  });
});

describe("tons das lentes", () => {
  const evidenceById = new Map(EVIDENCE.map((e) => [e.id, e]));
  it("pelas evidências citadas", () => {
    expect(lensToneOf(["pvp-baixo"], evidenceById)).toBe("favoravel");
    expect(lensToneOf(["vacancia-alta"], evidenceById)).toBe("desfavoravel");
    expect(lensToneOf(["pvp-baixo", "vacancia-alta"], evidenceById)).toBe("misto");
    expect(lensToneOf([], evidenceById)).toBe("neutro");
  });
  it("método: na fila favorável; fora ou Aguardar desfavorável; sem sinais null", () => {
    expect(methodLensTone(EVIDENCE)).toBe("favoravel");
    expect(methodLensTone([...EVIDENCE, ev("metodo-fora", "metodo", "desfavoravel")])).toBe(
      "desfavoravel",
    );
    expect(methodLensTone([ev("metodo-vies", "metodo", "desfavoravel")])).toBe("desfavoravel");
    expect(methodLensTone(EVIDENCE.filter((e) => e.group !== "metodo"))).toBeNull();
  });
});

describe("thesisFromReading e thesisView", () => {
  const reading = parse(answer())!;
  const stored = thesisFromReading({
    reading,
    evidence: EVIDENCE,
    key: "k",
    model: "m",
    now: NOW,
    termHistory: [],
  });

  it("guarda v2 com texto, frases, lentes com tom do código e evidências sem key", () => {
    expect(stored).toMatchObject({ version: 2, factsKey: "k", status: "ok", model: "m" });
    expect(stored.text).toBe(reading.sentences.map((s) => s.text).join(" "));
    expect(stored.lenses?.find((l) => l.id === "metodo")?.tone).toBe("favoravel");
    expect(stored.lenses?.find((l) => l.id === "imoveis")?.tone).toBe("desfavoravel");
    expect(stored.evidence?.[0]).toEqual({
      id: "metodo-rank",
      group: "metodo",
      tone: "favoravel",
      text: EVIDENCE[0].text,
    });
  });

  it("view: veredito, demais frases e lentes com rótulo", () => {
    const view = thesisView(stored, "FII", NOW);
    expect(view?.verdict).toBe(reading.sentences[0].text);
    expect(view?.sentences).toEqual([reading.sentences[1].text]);
    expect(view?.lenses[0]).toMatchObject({
      id: "imoveis",
      label: "Imóveis e crédito",
      persona: "Baroni",
    });
  });

  it("view: v1 só veredito; nada com falha, sem texto ou com mais de 10 dias", () => {
    const v1 = {
      factsKey: "k",
      status: "ok" as const,
      text: "Texto antigo.",
      model: null,
      generatedAt: NOW,
    };
    expect(thesisView(v1, "FII", NOW)).toMatchObject({
      verdict: "Texto antigo.",
      sentences: [],
      lenses: [],
    });
    expect(thesisView({ ...stored, status: "failed" }, "FII", NOW)).toBeNull();
    expect(thesisView({ ...stored, text: null }, "FII", NOW)).toBeNull();
    const old = new Date(NOW.getTime() - 10 * 86_400_000 - 1);
    expect(thesisView({ ...stored, generatedAt: old }, "FII", NOW)).toBeNull();
  });
});

describe("groupLenses", () => {
  it("a favor, atenção (desfavorável e misto) e neutro fora, na ordem", () => {
    const lens = (id: string, tone: "favoravel" | "desfavoravel" | "misto" | "neutro") => ({
      id,
      tone,
    });
    const { favor, attention } = groupLenses([
      lens("renda", "desfavoravel"),
      lens("imoveis", "favoravel"),
      lens("risco", "neutro"),
      lens("metodo", "misto"),
    ]);
    expect(favor.map((l) => l.id)).toEqual(["imoveis"]);
    expect(attention.map((l) => l.id)).toEqual(["renda", "metodo"]);
  });
});
