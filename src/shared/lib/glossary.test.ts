import { describe, expect, it } from "vitest";
import {
  GLOSSARY,
  glossaryEntry,
  glossaryIdsIn,
  glossarySegments,
  stripGlossary,
} from "./glossary";

const terms = (text: string, cls: "FII" | "ACAO" | null = null) =>
  glossarySegments(text, cls)
    .filter((s) => s.kind === "term")
    .map((s) => (s.kind === "term" ? `${s.id}:${s.value}` : ""));

describe("GLOSSARY", () => {
  it("definições curtas e ids únicos", () => {
    const ids = GLOSSARY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of GLOSSARY) expect(entry.definition.length).toBeLessThanOrEqual(200);
  });

  it("nenhum apelido em dois termos", () => {
    const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    const all = GLOSSARY.flatMap((e) => [e.term, ...e.aliases].map(fold));
    expect(new Set(all).size).toBe(all.length);
  });

  it("glossaryEntry por id", () => {
    expect(glossaryEntry("pvp")?.term).toBe("P/VP");
    expect(glossaryEntry("nao-existe")).toBeUndefined();
  });
});

describe("glossarySegments", () => {
  it("sem acento e sem caixa, guardando a grafia do texto", () => {
    expect(terms("A VACANCIA caiu.", "FII")).toEqual(["vacancia:VACANCIA"]);
    expect(terms("A vacância caiu.", "FII")).toEqual(["vacancia:vacância"]);
  });

  it("palavra inteira", () => {
    expect(terms("O fundo dyscontou.", "FII")).toEqual([]);
    expect(terms("O DY subiu.", "FII")).toEqual(["dividend-yield:DY"]);
  });

  it("apelido mais longo primeiro", () => {
    expect(terms("Paga mais que o Tesouro IPCA+ hoje.")).toEqual(["tesouro-ipca:Tesouro IPCA+"]);
    expect(terms("O dividend yield é bom.", "ACAO")).toEqual(["dividend-yield:dividend yield"]);
    expect(terms("A taxa Selic subiu.")).toEqual(["selic:taxa Selic"]);
  });

  it("só a primeira ocorrência de cada termo", () => {
    expect(terms("O P/VP baixo e o P/VP de antes.")).toEqual(["pvp:P/VP"]);
  });

  it("escopo: termo de FII não marca em ação; geral e cenário marcam em todos", () => {
    expect(terms("A vacância caiu.", "ACAO")).toEqual([]);
    expect(terms("O ROE caiu.", "FII")).toEqual([]);
    expect(terms("O ROE caiu.", "ACAO")).toEqual(["roe:ROE"]);
    expect(terms("A Selic e o P/VP.", "FII")).toEqual(["selic:Selic", "pvp:P/VP"]);
  });

  it("'papel' e 'tijolo' soltos não marcam", () => {
    expect(terms("O papel subiu.", "FII")).toEqual([]);
    expect(terms("É um fundo de papel.", "FII")).toEqual(["fundo-papel:fundo de papel"]);
  });

  it("juntar os segmentos devolve o texto", () => {
    const text = "A cota está bem abaixo do valor dos imóveis (P/VP baixo), mas a vacância subiu.";
    expect(
      glossarySegments(text, "FII")
        .map((s) => s.value)
        .join(""),
    ).toBe(text);
  });

  it("texto sem termo é um segmento só; vazio é lista vazia", () => {
    expect(glossarySegments("Nada aqui.", "FII")).toEqual([{ kind: "text", value: "Nada aqui." }]);
    expect(glossarySegments("", "FII")).toEqual([]);
  });
});

describe("glossaryIdsIn e stripGlossary", () => {
  it("ids distintos em ordem", () => {
    expect(glossaryIdsIn("O ROE e o P/L e o ROE.", "ACAO")).toEqual(["roe", "pl"]);
  });

  it("tira os termos do texto", () => {
    expect(stripGlossary("O dividend yield subiu.", "ACAO")).toBe(`O ${" ".repeat(14)} subiu.`);
  });
});
