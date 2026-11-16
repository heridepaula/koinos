import { describe, expect, it } from "vitest";
import { moneySegments } from "./money-segments";

const rejoin = (text: string) =>
  moneySegments(text)
    .map((s) => s.text)
    .join("");

describe("moneySegments", () => {
  it("separa um valor no meio do texto", () => {
    expect(moneySegments("reembolso de R$ 175,78 em 2025-12")).toEqual([
      { text: "reembolso de ", money: false },
      { text: "R$ 175,78", money: true },
      { text: " em 2025-12", money: false },
    ]);
  });

  it("separa dois valores", () => {
    const segments = moneySegments("de R$ 10,00 para R$ 20,50.");
    expect(segments.filter((s) => s.money).map((s) => s.text)).toEqual(["R$ 10,00", "R$ 20,50"]);
  });

  it("aceita milhar com ponto", () => {
    expect(moneySegments("R$ 1.234,56")).toEqual([{ text: "R$ 1.234,56", money: true }]);
  });

  it("não mascara limites legais sem centavos", () => {
    expect(moneySegments("limite de R$ 20.000")).toEqual([
      { text: "limite de R$ 20.000", money: false },
    ]);
    expect(moneySegments("acima de R$ 50.000 no mês")).toEqual([
      { text: "acima de R$ 50.000 no mês", money: false },
    ]);
  });

  it("devolve o texto sem valor como um só pedaço", () => {
    expect(moneySegments("sem valor aqui")).toEqual([{ text: "sem valor aqui", money: false }]);
  });

  it("devolve nada para texto vazio", () => {
    expect(moneySegments("")).toEqual([]);
  });

  it("a concatenação devolve o texto original", () => {
    for (const text of [
      "",
      "sem valor",
      "de R$ 175,78 em",
      "R$ 1,00 e R$ 2.000,00 e R$ 20.000",
      "R$ 175,78",
      "R$ 50.000 e R$ 3,10",
    ]) {
      expect(rejoin(text)).toBe(text);
    }
  });
});
