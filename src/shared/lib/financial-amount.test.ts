import { describe, expect, it } from "vitest";
import { parseFinancialAmount } from "./financial-amount";

describe("parseFinancialAmount", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["1,50", 1.5],
    ["R$ 1.500,00", 1500],
    ["R$ 1,50", 1.5],
    ["1234.56", 1234.56],
    ["1,234.56", 1234.56],
    ["1.234.567,89", 1234567.89],
    ["1,234,567", 1234567],
    ["1.234.567", 1234567],
    ["0,6741", 0.6741],
    ["0.6741", 0.6741],
    ["0.500", 0.5],
    ["1.5", 1.5],
    ["100", 100],
    ["-1,5", -1.5],
    ["−1,5", -1.5],
    ["(1.234,56)", -1234.56],
    ["  12,3  ", 12.3],
    ["1 234,5", 1234.5],
  ])("lê %s como %s", (text, expected) => {
    expect(parseFinancialAmount(text)).toBe(expected);
  });

  it("um ponto com 3 dígitos é ambíguo: milhar por padrão, decimal se a origem é inglesa", () => {
    expect(parseFinancialAmount("1.500")).toBe(1500);
    expect(parseFinancialAmount("1.500", { dotOnly: "decimal" })).toBe(1.5);
  });

  it.each([
    "",
    "   ",
    "-",
    "R$",
    "abc",
    "1e5",
    "NaN",
    "Infinity",
    "1..5",
    "1,,5",
    "1.23,4",
    "12.34.56",
    "1,5,5",
    "1,5.5,5",
    "1.234,56,7",
    ",5",
    "5,",
    "--1",
    "(-1)",
    "1 2 a",
  ])("recusa %j em vez de chutar um número", (text) => {
    expect(parseFinancialAmount(text)).toBeNull();
  });

  it("valores enormes que o JS não representa viram null, não Infinity", () => {
    expect(parseFinancialAmount("9".repeat(400))).toBeNull();
  });
});
