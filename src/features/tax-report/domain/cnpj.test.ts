import { describe, expect, it } from "vitest";
import { digitsOf, formatCnpj, isValidCnpj } from "./cnpj";

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
