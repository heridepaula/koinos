import { describe, expect, it } from "vitest";
import type { RadarFact, RadarInput } from "./radar";
import type { WeekSummary } from "./week-summary";
import {
  factNumber,
  methodSignals,
  needsThesis,
  THESIS,
  thesisEvidence,
  thesisKey,
  weekEvidence,
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
