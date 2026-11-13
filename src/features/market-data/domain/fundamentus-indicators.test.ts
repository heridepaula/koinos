import { describe, expect, it } from "vitest";
import { labelValues, parseFiiDetails, parseStockDetails } from "./fundamentus-indicators";

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);
const cell = (label: string, value: string) =>
  `<td class="label w2"><span class="help tips" title="x">?</span><span class="txt">${label}</span></td>\n\t\t\t\t\t<td class="data w2"><span class="txt">\n          ${value}</span></td>`;
const link = (label: string, text: string) =>
  `<td class="label"><span class="txt">${label}</span></td>\n<td class="data"><span class="txt"><a href="resultado.php?setor=20">${text}</a></span></td>`;
const page = (...cells: string[]) => `<html><table><tr>${cells.join("\n")}</tr></table></html>`;

// UNIP6, 2026-11-12
const unip6 = page(
  cell("Papel", "UNIP6"),
  cell("Cotação", "51,96"),
  link("Setor", "Químicos"),
  link("Subsetor", "Químicos Diversos"),
  cell("Últ balanço processado", "30/06/2026"),
  cell("P/L", "22,06"),
  cell("P/VP", "2,94"),
  cell("Marg. Líquida", "5,0%"),
  cell("Marg. EBIT", "13,2%"),
  cell("ROIC", "11,7%"),
  cell("ROE", "13,3%"),
  cell("Liquidez Corr", "2,39"),
  cell("Dív Líq / Patrim", "1,17"),
  cell("Cres. Rec (5a)", "-8,4%"),
  cell("Lucro Líquido", "266.558.000"),
  cell("Lucro Líquido", "125.074.000"), // os últimos 3 meses: o primeiro (12 meses) vale
);

// BBAS3, 2026-11-12: banco, com os zeros do Fundamentus
const bbas3 = page(
  cell("Papel", "BBAS3"),
  cell("Cotação", "15,48"),
  link("Setor", "Intermediários Financeiros"),
  link("Subsetor", "Bancos"),
  cell("P/VP", "0,53"),
  cell("Marg. Líquida", "0,0%"),
  cell("Marg. EBIT", "-"),
  cell("ROE", "7,0%"),
  cell("Liquidez Corr", "0,00"),
  cell("Dív Líq / Patrim", "0,00"),
);

describe("labelValues", () => {
  it("pega o primeiro valor de cada rótulo, mesmo dentro de link", () => {
    const map = labelValues(unip6);
    expect(map.get("Setor")).toBe("Químicos");
    expect(map.get("Lucro Líquido")).toBe("266.558.000");
  });
});

describe("parseStockDetails", () => {
  it("UNIP6: números brasileiros, % como fração, negativos e a data do balanço", () => {
    expect(parseStockDetails(unip6)).toEqual({
      kind: "ACAO",
      sector: "Químicos",
      subsector: "Químicos Diversos",
      balanceDate: at("2026-06-30"),
      pl: 22.06,
      pvp: 2.94,
      netMargin: 0.05,
      ebitMargin: 0.132,
      roe: 0.133,
      roic: 0.117,
      netDebtToEquity: 1.17,
      currentRatio: 2.39,
      revenueGrowth5y: -0.084,
      netIncome12m: 266558000,
    });
  });

  it("BBAS3: zeros de banco e '-' como ausentes", () => {
    const parsed = parseStockDetails(bbas3);
    expect(parsed.netMargin).toBeNull();
    expect(parsed.ebitMargin).toBeNull();
    expect(parsed.netDebtToEquity).toBeNull();
    expect(parsed.currentRatio).toBeNull();
    expect(parsed.roe).toBeCloseTo(0.07);
    expect(parsed.pvp).toBe(0.53);
    expect(parsed.subsector).toBe("Bancos");
    expect(parsed.balanceDate).toBeNull();
  });

  it("ITSA4: margem acima de 100% é ausente", () => {
    const html = page(
      cell("Papel", "ITSA4"),
      cell("Cotação", "13,57"),
      cell("Marg. Líquida", "217,5%"),
    );
    expect(parseStockDetails(html).netMargin).toBeNull();
  });

  it("TUPY3: prejuízo e ROE negativo", () => {
    const html = page(
      cell("Papel", "TUPY3"),
      cell("Cotação", "19,10"),
      cell("ROE", "-29,0%"),
      cell("Lucro Líquido", "-150.000.000"),
    );
    const parsed = parseStockDetails(html);
    expect(parsed.roe).toBeCloseTo(-0.29);
    expect(parsed.netIncome12m).toBe(-150000000);
  });

  it("recusa página sem os rótulos esperados", () => {
    expect(() => parseStockDetails("<html>Papel não encontrado</html>")).toThrow(/rótulos/);
  });
});

describe("parseFiiDetails", () => {
  it("HGLG11: FFO Yield, Cap Rate, imóveis e o informe", () => {
    const html = page(
      cell("FII", "HGLG11"),
      cell("Cotação", "145,97"),
      cell("Últ Info Trimestral", "30/06/2026"),
      cell("FFO Yield", "7,63%"),
      cell("Cap Rate", "9,2%"),
      cell("Qtd imóveis", "37"),
    );
    expect(parseFiiDetails(html)).toEqual({
      kind: "FII",
      ffoYield: 0.0763,
      capRate: 0.092,
      propertyCount: 37,
      quarterlyReport: at("2026-06-30"),
    });
  });

  it("papel (RECR11): Cap Rate 0 e nenhum imóvel ficam ausentes", () => {
    const html = page(
      cell("FII", "RECR11"),
      cell("Cotação", "68,41"),
      cell("FFO Yield", "15,61%"),
      cell("Cap Rate", "0,0%"),
      cell("Qtd imóveis", "0"),
    );
    const parsed = parseFiiDetails(html);
    expect(parsed.capRate).toBeNull();
    expect(parsed.propertyCount).toBeNull();
    expect(parsed.ffoYield).toBeCloseTo(0.1561);
  });

  it("recusa página de ação no lugar de FII", () => {
    expect(() => parseFiiDetails(unip6)).toThrow(/rótulos/);
  });
});
