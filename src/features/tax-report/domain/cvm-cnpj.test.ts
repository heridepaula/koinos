import { describe, expect, it } from "vitest";
import {
  decodeCvm,
  fiiCnpjForTicker,
  nameScore,
  parseCvmCsv,
  resolveCnpjs,
  stockCnpjByTicker,
} from "./cvm-cnpj";

describe("parseCvmCsv", () => {
  it("lê ; aspas e vazios", () => {
    const rows = parseCvmCsv('A;B;C\n1;"x;y";\n2;z;w');
    expect(rows).toEqual([
      { A: "1", B: "x;y", C: "" },
      { A: "2", B: "z", C: "w" },
    ]);
  });

  it("aceita CRLF, aspas escapadas e arquivo vazio", () => {
    expect(parseCvmCsv('A;B\r\n"a ""b""";c\r\n')).toEqual([{ A: 'a "b"', B: "c" }]);
    expect(parseCvmCsv("")).toEqual([]);
  });
});

describe("stockCnpjByTicker", () => {
  const rows = [
    {
      CNPJ_Companhia: "33.000.167/0001-01",
      Codigo_Negociacao: "PETR3, PETR4",
      Nome_Empresarial: "PETROBRAS",
    },
    { CNPJ_Companhia: "02.474.103/0001-19", Codigo_Negociacao: "EGIE3", Nome_Empresarial: "ENGIE" },
    { CNPJ_Companhia: "11.111.111/0001-11", Codigo_Negociacao: "N/A", Nome_Empresarial: "X" },
    { CNPJ_Companhia: "11.111.111/0001-11", Codigo_Negociacao: "NÃO HÁ", Nome_Empresarial: "X" },
    { CNPJ_Companhia: "11.111.111/0001-11", Codigo_Negociacao: "0000", Nome_Empresarial: "X" },
    { CNPJ_Companhia: "22.222.222/0001-22", Codigo_Negociacao: "DUPL3", Nome_Empresarial: "A" },
    { CNPJ_Companhia: "33.333.333/0001-33", Codigo_Negociacao: "DUPL3", Nome_Empresarial: "B" },
  ];
  it("casa por ticker, separa listas e descarta lixo e ambíguos", () => {
    const m = stockCnpjByTicker(rows);
    expect(m.get("PETR4")).toEqual({ cnpj: "33.000.167/0001-01", legalName: "PETROBRAS" });
    expect(m.get("PETR3")?.cnpj).toBe("33.000.167/0001-01");
    expect(m.get("EGIE3")?.cnpj).toBe("02.474.103/0001-19");
    expect(m.has("N/A")).toBe(false);
    expect(m.has("NÃO HÁ")).toBe(false);
    expect(m.has("0000")).toBe(false);
    expect(m.has("DUPL3")).toBe(false);
  });
});

describe("fiiCnpjForTicker", () => {
  const funds = [
    { cnpj: "11.111.111/0001-11", name: "FUNDO HGLG", isin: "BRHGLGCTF004" },
    { cnpj: "11.111.111/0001-11", name: "FUNDO HGLG", isin: "BRHGLGCTF004" },
    { cnpj: "22.222.222/0001-22", name: "FUNDO XPLG", isin: "BRXPLGCTF005" },
    { cnpj: "33.333.333/0001-33", name: "OUTRO A", isin: "BRABCDCTF001" },
    { cnpj: "44.444.444/0001-44", name: "OUTRO B", isin: "BRABCDCTF002" },
  ];
  it("casa pelo prefixo do ISIN quando só um CNPJ corresponde", () => {
    expect(fiiCnpjForTicker("HGLG11", funds)).toEqual({
      cnpj: "11.111.111/0001-11",
      legalName: "FUNDO HGLG",
    });
  });
  it("devolve null sem correspondência ou com mais de um CNPJ", () => {
    expect(fiiCnpjForTicker("ZZZZ11", funds)).toBeNull();
    expect(fiiCnpjForTicker("ABCD11", funds)).toBeNull();
  });
});

describe("nameScore", () => {
  it("conta os tokens significativos em comum, sem acento nem caixa", () => {
    expect(nameScore("XP Malls Fundo de Investimento Imobiliário FII", "XP MALLS FII")).toBe(2);
    expect(nameScore("Kilima Fundo De Investimento Em Cotas Suno", "KILIMA FIC FII")).toBe(1);
    expect(nameScore("Açaí Ímpar", "ACAI IMPAR")).toBe(2);
  });
  it("ignora as palavras genéricas", () => {
    expect(
      nameScore("FUNDO DE INVESTIMENTO IMOBILIÁRIO", "FUNDO DE INVESTIMENTO IMOBILIARIO"),
    ).toBe(0);
  });
});

describe("fiiCnpjForTicker por nome (empate de ISIN)", () => {
  const xp = "28.757.546/0001-00";
  const funds = [
    { cnpj: xp, name: "XP MALLS FII", isin: "BRXPMLCTF000" },
    { cnpj: "07.583.627/0001-61", name: "PENINSULA FII RL", isin: "BRXPMLCTF001" },
    {
      cnpj: "28.548.288/0001-52",
      name: "TRX REAL ESTATE FUNDO DE INVESTIMENTO IMOBILIÁRIO",
      isin: "BRTRXFCTF000",
    },
    {
      cnpj: "63.134.454/0001-75",
      name: "LIQUIDEZ PROJETOS GD FI IMOBILIÁRIO RESP LIMITADA",
      isin: "BRTRXFCTF001",
    },
    { cnpj: "36.669.660/0001-07", name: "KILIMA FIC FII", isin: "BRKISUCTF000" },
    {
      cnpj: "65.923.811/0001-00",
      name: "FII RIVIERA RESIDENCIAL RESPONSABILIDADE LIMITADA",
      isin: "BRKISUCTF001",
    },
    { cnpj: "33.333.333/0001-33", name: "OUTRO A", isin: "BRABCDCTF001" },
    { cnpj: "44.444.444/0001-44", name: "OUTRO B", isin: "BRABCDCTF002" },
    { cnpj: "55.555.555/0001-55", name: "SOLO FII", isin: "BRSOLOCTF001" },
  ];

  it("escolhe o candidato que o nome do app identifica (casos reais)", () => {
    expect(
      fiiCnpjForTicker("XPML11", funds, "XP MALLS FUNDO DE INVESTIMENTO IMOBILIÁRIO FII"),
    ).toEqual({ cnpj: xp, legalName: "XP MALLS FII", byName: true });
    expect(
      fiiCnpjForTicker(
        "TRXF11",
        funds,
        "TRX REAL ESTATE FUNDO DE INVESTIMENTO IMOBILIÁRIO RESPONSABILIDADE LIMITADA",
      )?.cnpj,
    ).toBe("28.548.288/0001-52");
    expect(
      fiiCnpjForTicker(
        "KISU11",
        funds,
        "Kilima Fundo De Investimento Em Cotas De Fundos Imobiliarios Suno 30",
      )?.cnpj,
    ).toBe("36.669.660/0001-07");
  });
  it("empate verdadeiro fica sem casamento", () => {
    expect(fiiCnpjForTicker("ABCD11", funds, "OUTRO FII")).toBeNull();
  });
  it("sem nome do app fica sem casamento", () => {
    expect(fiiCnpjForTicker("XPML11", funds)).toBeNull();
    expect(fiiCnpjForTicker("XPML11", funds, null)).toBeNull();
  });
  it("palavras genéricas sozinhas não decidem", () => {
    expect(fiiCnpjForTicker("XPML11", funds, "FUNDO DE INVESTIMENTO IMOBILIÁRIO")).toBeNull();
  });
  it("candidato único continua sem precisar de nome", () => {
    expect(fiiCnpjForTicker("SOLO11", funds)).toEqual({
      cnpj: "55.555.555/0001-55",
      legalName: "SOLO FII",
    });
  });
  it("o melhor com score 2+ precisa de pelo menos o dobro do segundo", () => {
    const f = [
      { cnpj: "1", name: "ALFA BETA GAMA", isin: "BRDUPLCTF001" },
      { cnpj: "2", name: "ALFA BETA DELTA", isin: "BRDUPLCTF002" },
    ];
    expect(fiiCnpjForTicker("DUPL11", f, "ALFA BETA GAMA")).toBeNull();
    const g = [
      { cnpj: "1", name: "ALFA BETA GAMA", isin: "BRDUPLCTF001" },
      { cnpj: "2", name: "ALFA OUTRO", isin: "BRDUPLCTF002" },
    ];
    expect(fiiCnpjForTicker("DUPL11", g, "ALFA BETA GAMA")?.cnpj).toBe("1");
  });
});

describe("decodeCvm", () => {
  it("decodifica Latin-1", () => {
    expect(decodeCvm(new Uint8Array([0xe7, 0xe3]))).toBe("çã");
  });
});

describe("resolveCnpjs", () => {
  const stocks = new Map([["EGIE3", { cnpj: "02.474.103/0001-19", legalName: "ENGIE" }]]);
  const funds = [{ cnpj: "11.111.111/0001-11", name: "FUNDO HGLG", isin: "BRHGLGCTF004" }];
  const targets = [
    { ticker: "EGIE3", assetClass: "ACAO" as const, name: "ENGIE" },
    { ticker: "HGLG11", assetClass: "FII" as const, name: null },
    { ticker: "ZZZZ11", assetClass: "FII" as const, name: null },
    { ticker: "ABCD3", assetClass: "ACAO" as const, name: null },
  ];

  it("separa o que casou, com a fonte de cada um, do que ficou sem CNPJ", () => {
    const { matched, unmatched } = resolveCnpjs(targets, stocks, funds);
    expect(matched).toEqual([
      { ticker: "EGIE3", cnpj: "02.474.103/0001-19", legalName: "ENGIE", source: "CVM_FCA" },
      { ticker: "HGLG11", cnpj: "11.111.111/0001-11", legalName: "FUNDO HGLG", source: "CVM_ISIN" },
    ]);
    expect(unmatched).toEqual(["ZZZZ11", "ABCD3"]);
  });

  it("marca CVM_ISIN_NOME quando o nome desempata", () => {
    const tie = [
      { cnpj: "1", name: "XP MALLS FII", isin: "BRXPMLCTF000" },
      { cnpj: "2", name: "PENINSULA FII RL", isin: "BRXPMLCTF001" },
    ];
    const { matched } = resolveCnpjs(
      [{ ticker: "XPML11", assetClass: "FII", name: "XP MALLS FUNDO IMOBILIÁRIO" }],
      new Map(),
      tie,
    );
    expect(matched).toEqual([
      { ticker: "XPML11", cnpj: "1", legalName: "XP MALLS FII", source: "CVM_ISIN_NOME" },
    ]);
  });
});
