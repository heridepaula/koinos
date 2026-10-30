import { describe, expect, it } from "vitest";
import { assetClassOf } from "./asset-class";

const fund = (subType: string | null) => ({ type: "fund", subType });
const stock = (subType: string) => ({ type: "stock", subType });

describe("assetClassOf: pelo catálogo da brapi", () => {
  it("FII e Fiagro são FII", () => {
    expect(assetClassOf("BTLG11", fund("fii"))).toBe("FII");
    expect(assetClassOf("SNAG11", fund("fi-agro"))).toBe("FII");
  });

  it("ação e unit são ação", () => {
    expect(assetClassOf("PETR4", stock("stock"))).toBe("ACAO");
    expect(assetClassOf("TAEE11", stock("unit"))).toBe("ACAO");
  });

  it("fundo sem subtipo só é FII com código XXXX11", () => {
    expect(assetClassOf("ABCD11", fund(null))).toBe("FII");
    expect(assetClassOf("ABCD13", fund(null))).toBeNull();
  });

  it("ETF, FI-Infra, FIP e FIDC ficam de fora", () => {
    expect(assetClassOf("BOVA11", fund("etf"))).toBeNull();
    expect(assetClassOf("JURO11", fund("fi-infra"))).toBeNull();
    expect(assetClassOf("ABCD11", fund("fip"))).toBeNull();
    expect(assetClassOf("ABCD11", fund("fidc"))).toBeNull();
  });
});

describe("assetClassOf: fora do catálogo, pelo código", () => {
  it("XXXX11 é FII que saiu da bolsa", () => {
    expect(assetClassOf("MALL11", null)).toBe("FII");
  });

  it("4 caracteres + 3 a 8 é ação que saiu da bolsa", () => {
    expect(assetClassOf("NEOE3", null)).toBe("ACAO");
    expect(assetClassOf("B3SA3", null)).toBe("ACAO");
    expect(assetClassOf("ABCD8", null)).toBe("ACAO");
  });

  it("direitos, recibos e o resto ficam de fora", () => {
    for (const code of ["PETR1", "PETR2", "PETR9", "PETR10", "BTLG12", "SNCI13", "CDB"]) {
      expect(assetClassOf(code, null)).toBeNull();
    }
  });
});
