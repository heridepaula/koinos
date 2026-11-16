import { describe, expect, it } from "vitest";
import { digitsOf, formatCnpj, isValidCnpj, maskCnpj } from "./cnpj";

describe("isValidCnpj", () => {
  it("aceita CNPJs reais, com ou sem máscara", () => {
    expect(isValidCnpj("33.000.167/0001-01")).toBe(true);
    expect(isValidCnpj("33000167000101")).toBe(true);
    expect(isValidCnpj("00.000.000/0001-91")).toBe(true);
  });
  it("recusa dígito errado, tamanho errado e repetidos", () => {
    expect(isValidCnpj("33.000.167/0001-02")).toBe(false);
    expect(isValidCnpj("33.000.167/0001")).toBe(false);
    expect(isValidCnpj("11.111.111/1111-11")).toBe(false);
    expect(isValidCnpj("")).toBe(false);
  });
});

describe("formatCnpj e digitsOf", () => {
  it("põe a máscara em 14 dígitos e devolve o resto como veio", () => {
    expect(formatCnpj("33000167000101")).toBe("33.000.167/0001-01");
    expect(formatCnpj("123")).toBe("123");
    expect(digitsOf("33.000.167/0001-01")).toBe("33000167000101");
  });
});

describe("maskCnpj", () => {
  it("põe a máscara aos poucos, enquanto se digita", () => {
    expect(maskCnpj("")).toBe("");
    expect(maskCnpj("33")).toBe("33");
    expect(maskCnpj("33000")).toBe("33.000");
    expect(maskCnpj("33000167")).toBe("33.000.167");
    expect(maskCnpj("330001670001")).toBe("33.000.167/0001");
    expect(maskCnpj("33000167000101")).toBe("33.000.167/0001-01");
  });

  it("ignora o que não é dígito e o que passa de 14", () => {
    expect(maskCnpj("33.000.167/0001-01 99")).toBe("33.000.167/0001-01");
    expect(maskCnpj("ab")).toBe("");
  });
});
