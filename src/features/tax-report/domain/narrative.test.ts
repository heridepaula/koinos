import { describe, expect, it } from "vitest";
import {
  acceptCodeNarrative,
  acceptRewrite,
  buildNarrativePrompt,
  FINDING_DESCRIPTIONS,
  narrativeKey,
  narrativesComplete,
  narrativeSchema,
  narrativesView,
  numbersIn,
  parseNarratives,
  validPositionTexts,
} from "./narrative";
import type { FiscalFlagCode } from "./types";

const ref =
  "200 AÇÕES DE PETRÓLEO BRASILEIRO S.A. (PETR4), CNPJ 33.000.167/0001-01. CUSTO TOTAL DE AQUISIÇÃO: R$ 2.205,00 (PREÇO MÉDIO DE R$ 11,025).";
const goodRewrite =
  "Possuo 200 ações da Petróleo Brasileiro S.A. (PETR4), CNPJ 33.000.167/0001-01, com custo total de aquisição de R$ 2.205,00 e preço médio de R$ 11,025.";
const goodCode = "Confira se o ativo está com o CNPJ do emissor informado antes de declarar.";

describe("numbersIn", () => {
  it("tira a pontuação final do número", () => {
    expect(numbersIn("preço médio de R$ 11,025. Em 2025,")).toEqual(["11,025", "2025"]);
  });
});

describe("acceptRewrite", () => {
  it("aceita a mesma informação com outra redação", () => {
    expect(acceptRewrite(goodRewrite, ref)).toEqual({ ok: true });
  });
  it("recusa texto vazio", () => {
    expect(acceptRewrite("   ", ref)).toEqual({ ok: false, rule: "vazio" });
  });
  it("recusa texto com mais de 600 caracteres", () => {
    expect(acceptRewrite(goodRewrite + " x".repeat(400), ref)).toEqual({
      ok: false,
      rule: "longo",
    });
  });
  it("recusa texto sem acentos quando a referência tem", () => {
    const noAccent = goodRewrite.normalize("NFD").replace(/[̀-ͯ]/g, "");
    expect(acceptRewrite(noAccent, ref)).toEqual({
      ok: false,
      rule: "sem-acento",
    });
  });
  it("recusa número extra", () => {
    expect(acceptRewrite(goodRewrite + " Em 2025.", ref)).toEqual({
      ok: false,
      rule: "numero-extra",
    });
  });
  it("recusa número trocado (CNPJ, quantidade ou valor)", () => {
    expect(acceptRewrite(goodRewrite.replace("2.205,00", "2.206,00"), ref)).toMatchObject({
      ok: false,
    });
    expect(acceptRewrite(goodRewrite.replace("200 ações", "300 ações"), ref)).toMatchObject({
      ok: false,
    });
    expect(
      acceptRewrite(goodRewrite.replace("33.000.167/0001-01", "33.000.167/0001-02"), ref),
    ).toMatchObject({ ok: false });
  });
  it("recusa o total e o preço médio trocados de lugar", () => {
    const swapped =
      "Possuo 200 ações da Petróleo Brasileiro S.A. (PETR4), CNPJ 33.000.167/0001-01, com custo total de aquisição de R$ 11,025 e preço médio de R$ 2.205,00.";
    expect(acceptRewrite(swapped, ref)).toEqual({ ok: false, rule: "numero-fora-de-ordem" });
  });
  it("aceita outra frase com os números na mesma ordem", () => {
    const other =
      "Tenho 200 ações da Petróleo Brasileiro S.A. (PETR4), inscrita no CNPJ 33.000.167/0001-01; custo total de R$ 2.205,00 e preço médio de R$ 11,025.";
    expect(acceptRewrite(other, ref)).toEqual({ ok: true });
  });
  it("recusa a quantidade repetida no texto", () => {
    expect(
      acceptRewrite(goodRewrite.replace("com custo", "ou seja, 200 ações, com custo"), ref),
    ).toEqual({
      ok: false,
      rule: "numero-fora-de-ordem",
    });
  });
  it("recusa número faltando", () => {
    expect(acceptRewrite("Possuo ações da Petróleo (PETR4), com 200 unidades.", ref)).toEqual({
      ok: false,
      rule: "numero-faltando",
    });
  });
});

describe("acceptCodeNarrative", () => {
  it("aceita um texto sem dígito", () => {
    expect(acceptCodeNarrative(goodCode)).toEqual({ ok: true });
  });
  it("recusa vazio", () => {
    expect(acceptCodeNarrative("")).toEqual({ ok: false, rule: "vazio" });
  });
  it("recusa mais de 300 caracteres", () => {
    expect(acceptCodeNarrative(goodCode + " x".repeat(200))).toEqual({ ok: false, rule: "longo" });
  });
  it("recusa dígito em qualquer posição", () => {
    expect(acceptCodeNarrative("Confira o ativo em 2025, pois é preciso.")).toEqual({
      ok: false,
      rule: "digito",
    });
    expect(acceptCodeNarrative("Confira o ativo PETR4 antes de declarar, é preciso.")).toEqual({
      ok: false,
      rule: "digito",
    });
  });
  it("recusa texto sem acentos", () => {
    expect(acceptCodeNarrative("Confira se o ativo tem CNPJ informado.")).toEqual({
      ok: false,
      rule: "sem-acento",
    });
  });
});

const references = { PETR4: ref, XPLG11: "100 COTAS DE XP LOG (XPLG11), CNPJ 26.502.794/0001-85." };
const codes: FiscalFlagCode[] = ["CNPJ_AUSENTE", "PRECO_ESTIMADO"];

describe("buildNarrativePrompt", () => {
  const prompt = buildNarrativePrompt({
    positions: [
      { ticker: "PETR4", assetClass: "ACAO", reference: ref },
      { ticker: "XPLG11", assetClass: "FII", reference: references.XPLG11 },
    ],
    codes,
  });

  it("leva ticker, classe, quantidade, CNPJ e razão social das posições", () => {
    expect(prompt).toContain("<dados>");
    expect(prompt).toContain("PETR4");
    expect(prompt).toContain("33.000.167/0001-01");
    expect(prompt).toContain("200 AÇÕES");
    expect(prompt).toContain("PETRÓLEO BRASILEIRO");
  });
  it("leva os códigos com a descrição fixa", () => {
    expect(prompt).toContain("CNPJ_AUSENTE");
    expect(prompt).toContain(FINDING_DESCRIPTIONS.CNPJ_AUSENTE);
    expect(prompt).not.toContain("DAY_TRADE_NAO_APURADO");
  });
  it("não leva id de carteira, e-mail nem patrimônio", () => {
    expect(prompt).not.toMatch(/portfolioId|@|patrim/i);
  });
  it("não leva ticker nem valor dentro da parte dos achados", () => {
    const part = prompt.slice(prompt.indexOf("<achados>"), prompt.indexOf("</achados>"));
    expect(part).not.toMatch(/PETR4|XPLG11/);
    expect(part).not.toMatch(/R\$|\d/);
  });
});

describe("FINDING_DESCRIPTIONS", () => {
  it("não tem dígito nem R$ (o modelo não pode copiar número)", () => {
    for (const text of Object.values(FINDING_DESCRIPTIONS)) {
      expect(text).not.toMatch(/\d|R\$/);
    }
  });
});

describe("narrativeSchema", () => {
  it("tem as chaves na ordem e additionalProperties false", () => {
    const schema = narrativeSchema as {
      properties: Record<string, { items: { properties: object; additionalProperties: boolean } }>;
      required: string[];
      additionalProperties: boolean;
    };
    expect(Object.keys(schema.properties)).toEqual(["positions", "codeNarratives"]);
    expect(schema.required).toEqual(["positions", "codeNarratives"]);
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties.positions.items.properties)).toEqual(["ticker", "text"]);
    expect(Object.keys(schema.properties.codeNarratives.items.properties)).toEqual([
      "code",
      "text",
    ]);
    expect(schema.properties.positions.items.additionalProperties).toBe(false);
    expect(schema.properties.codeNarratives.items.additionalProperties).toBe(false);
  });
});

describe("parseNarratives", () => {
  it("devolve só os textos aceitos e conta as recusas por regra", () => {
    const json = JSON.stringify({
      positions: [
        { ticker: "PETR4", text: goodRewrite },
        { ticker: "XPLG11", text: "100 cotas de XP Log (XPLG11), CNPJ 26.502.794/0001-85 e 2025." },
      ],
      codeNarratives: [
        { code: "CNPJ_AUSENTE", text: goodCode },
        { code: "PRECO_ESTIMADO", text: "O custo tem 3 estimativas, é preciso conferir." },
      ],
    });
    const out = parseNarratives(json, references, codes);
    expect(out.positions).toEqual({ PETR4: goodRewrite });
    expect(out.codes).toEqual({ CNPJ_AUSENTE: goodCode });
    expect(out.accepted).toBe(2);
    expect(out.rejected).toBe(2);
    expect(out.rejections).toEqual({ "numero-extra": 1, digito: 1 });
  });
  it("recusa ticker e código que não foram enviados", () => {
    const json = JSON.stringify({
      positions: [{ ticker: "VALE3", text: goodRewrite }],
      codeNarratives: [{ code: "DAY_TRADE_NAO_APURADO", text: goodCode }],
    });
    const out = parseNarratives(json, references, codes);
    expect(out.accepted).toBe(0);
    expect(out.rejections).toEqual({ "ticker-desconhecido": 1, "codigo-desconhecido": 1 });
  });
  it("JSON cortado ou fora do formato recusa tudo com json-invalido", () => {
    for (const bad of ['{"positions": [{"ticker": "PE', "[]", '{"positions": 1}', ""]) {
      const out = parseNarratives(bad, references, codes);
      expect(out.accepted).toBe(0);
      expect(out.positions).toEqual({});
      expect(out.codes).toEqual({});
      expect(out.rejections).toEqual({ "json-invalido": 1 });
    }
  });
});

describe("narrativeKey", () => {
  it("é estável para a mesma entrada, qualquer que seja a ordem", () => {
    const a = narrativeKey(references, codes);
    expect(a).toBe(narrativeKey({ XPLG11: references.XPLG11, PETR4: ref }, [...codes].reverse()));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("muda quando uma referência ou um código muda", () => {
    const a = narrativeKey(references, codes);
    expect(narrativeKey({ ...references, PETR4: ref.replace("200", "201") }, codes)).not.toBe(a);
    expect(narrativeKey(references, [...codes, "DAY_TRADE_NAO_APURADO"])).not.toBe(a);
  });
});

describe("validPositionTexts", () => {
  it("mantém só o ticker que ainda existe e cujo texto ainda passa contra a referência atual", () => {
    const stored = {
      PETR4: goodRewrite,
      XPLG11: "texto antigo de outro valor 999",
      VALE3: goodRewrite,
    };
    expect(validPositionTexts(stored, references)).toEqual({ PETR4: goodRewrite });
  });
});

describe("narrativesView", () => {
  const key = narrativeKey(references, codes);
  const stored = {
    key,
    status: "ok" as const,
    positions: { PETR4: goodRewrite },
    codes: { CNPJ_AUSENTE: goodCode, DAY_TRADE_NAO_APURADO: goodCode },
  };

  it("sem documento: none e vazio", () => {
    expect(narrativesView(null, references, codes)).toEqual({
      status: "none",
      positions: {},
      codes: {},
      stale: false,
    });
  });
  it("com a chave igual: não está vencido e filtra os códigos que não existem mais", () => {
    expect(narrativesView(stored, references, codes)).toEqual({
      status: "ok",
      positions: { PETR4: goodRewrite },
      codes: { CNPJ_AUSENTE: goodCode },
      stale: false,
    });
  });
  it("com a chave diferente: vencido, mas os textos que ainda valem continuam", () => {
    const view = narrativesView({ ...stored, key: "outra" }, references, codes);
    expect(view.stale).toBe(true);
    expect(view.positions).toEqual({ PETR4: goodRewrite });
  });
  it("mantém o status failed com os textos aceitos antes", () => {
    const view = narrativesView({ ...stored, status: "failed" }, references, codes);
    expect(view.status).toBe("failed");
    expect(view.positions).toEqual({ PETR4: goodRewrite });
  });
  it("recusa texto de código com dígito mesmo guardado", () => {
    const view = narrativesView(
      { ...stored, codes: { CNPJ_AUSENTE: "tem 1 número aí" } },
      references,
      codes,
    );
    expect(view.codes).toEqual({});
  });
});

describe("narrativesComplete", () => {
  const full = { codes: { CNPJ_AUSENTE: goodCode } };
  const refs = { PETR4: ref };
  const only = { references: refs, codes: ["CNPJ_AUSENTE"] as FiscalFlagCode[] };

  it("completo: todo ticker e todo código têm texto aceito", () => {
    expect(narrativesComplete(only, { positions: { PETR4: goodRewrite }, codes: full.codes })).toBe(
      true,
    );
  });
  it("falta um ticker", () => {
    expect(narrativesComplete(only, { positions: {}, codes: full.codes })).toBe(false);
  });
  it("falta um código", () => {
    expect(narrativesComplete(only, { positions: { PETR4: goodRewrite }, codes: {} })).toBe(false);
  });
  it("texto guardado que não passa mais na referência não conta", () => {
    expect(
      narrativesComplete(only, { positions: { PETR4: "sem números" }, codes: full.codes }),
    ).toBe(false);
  });
  it("sobra texto de ticker que saiu: continua completo", () => {
    expect(
      narrativesComplete(only, {
        positions: { PETR4: goodRewrite, VALE3: goodRewrite },
        codes: full.codes,
      }),
    ).toBe(true);
  });
  it("sem documento guardado: incompleto, e sem nada a gerar: completo", () => {
    expect(narrativesComplete(only, null)).toBe(false);
    expect(narrativesComplete({ references: {}, codes: [] }, null)).toBe(true);
  });
});
