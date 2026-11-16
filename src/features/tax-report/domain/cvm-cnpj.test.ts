import { describe, expect, it } from "vitest";
import {
  decodeCvm,
  fiiCnpjForTicker,
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

describe("decodeCvm", () => {
  it("decodifica Latin-1", () => {
    expect(decodeCvm(new Uint8Array([0xe7, 0xe3]))).toBe("çã");
  });
});

describe("resolveCnpjs", () => {
  const stocks = new Map([["EGIE3", { cnpj: "02.474.103/0001-19", legalName: "ENGIE" }]]);
  const funds = [{ cnpj: "11.111.111/0001-11", name: "FUNDO HGLG", isin: "BRHGLGCTF004" }];
  const targets = [
    { ticker: "EGIE3", assetClass: "ACAO" as const },
    { ticker: "HGLG11", assetClass: "FII" as const },
    { ticker: "ZZZZ11", assetClass: "FII" as const },
    { ticker: "ABCD3", assetClass: "ACAO" as const },
  ];

  it("separa o que casou, com a fonte de cada um, do que ficou sem CNPJ", () => {
    const { matched, unmatched } = resolveCnpjs(targets, stocks, funds);
    expect(matched).toEqual([
      { ticker: "EGIE3", cnpj: "02.474.103/0001-19", legalName: "ENGIE", source: "CVM_FCA" },
      { ticker: "HGLG11", cnpj: "11.111.111/0001-11", legalName: "FUNDO HGLG", source: "CVM_ISIN" },
    ]);
    expect(unmatched).toEqual(["ZZZZ11", "ABCD3"]);
  });
});
