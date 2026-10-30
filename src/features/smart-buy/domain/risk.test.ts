import { describe, expect, it } from "vitest";
import { classifyRisk, type RiskInput } from "./risk";

const input = (overrides: Partial<RiskInput>): RiskInput => ({
  fundType: null,
  segment: null,
  paperPct: null,
  realEstatePct: null,
  category: null,
  ...overrides,
});

describe("classifyRisk", () => {
  it("papel e Fiagro vão para papel; tijolo para tijolo", () => {
    expect(classifyRisk(input({ fundType: "Papel" })).macro).toBe("Papel");
    expect(classifyRisk(input({ fundType: "Fiagro" })).macro).toBe("Papel");
    expect(classifyRisk(input({ fundType: "Tijolo" })).macro).toBe("Tijolo");
  });

  it("híbrido é papel só se for majoritariamente recebíveis", () => {
    expect(
      classifyRisk(input({ fundType: "Híbrido", paperPct: 3.8, realEstatePct: 66.7 })).macro,
    ).toBe("Tijolo");
    expect(
      classifyRisk(input({ fundType: "Híbrido", paperPct: 80, realEstatePct: 10 })).macro,
    ).toBe("Papel");
  });

  it("FoF fica em Outros; sem o tipo, vale a categoria da Carteira Alvo", () => {
    expect(classifyRisk(input({ fundType: "Fundo de Fundos" })).macro).toBe("Outros");
    expect(classifyRisk(input({ category: "FII_PAPEL" })).macro).toBe("Papel");
    expect(classifyRisk(input({ category: "FII_TIJOLO" })).macro).toBe("Tijolo");
    expect(classifyRisk(input({})).macro).toBe("Outros");
  });

  it("só segmentos específicos formam setor", () => {
    expect(classifyRisk(input({ fundType: "Tijolo", segment: "Shoppings" })).sector).toBe(
      "Shoppings",
    );
    for (const segment of ["Multicategoria", "Outros", "Híbrido", " ", null]) {
      expect(classifyRisk(input({ fundType: "Tijolo", segment })).sector).toBeNull();
    }
  });

  it("papel não divide setor, mesmo com segmento específico na CVM", () => {
    expect(classifyRisk(input({ fundType: "Papel", segment: "Logística" })).sector).toBeNull();
  });
});
