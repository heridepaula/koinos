import { describe, expect, it } from "vitest";
import { parseBrDate, parseBrNumber, parseFundamentusDividends } from "./fundamentus";

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);
const page = (head: string, rows: string[][]) =>
  `<html><table id="resultado"><thead><tr>${head}</tr></thead><tbody>${rows
    .map(
      (row, i) =>
        `<tr class="${i % 2 ? "par" : ""}">${row.map((c) => `<td>${c}</td>`).join("")}</tr>`,
    )
    .join("\n")}</tbody></table></html>`;

describe("parseFundamentusDividends", () => {
  it("FII: data com, tipo, pagamento e valor; só Rendimento", () => {
    const html = page("<th>Última Data Com</th>", [
      ["30/10/2026", "Rendimento", "16/11/2026", "1,17"],
      ["30/09/2026", "Amortização", "15/10/2026", "0,50"],
      ["31/08/2026", "Rendimento", "-", "1,10"],
    ]);
    expect(parseFundamentusDividends(html, "fii")).toEqual([
      { comDate: at("2026-10-30"), payDate: at("2026-11-16"), perShare: 1.17, kind: "RENDIMENTO" },
    ]);
  });

  it("ação: valor por lote, JCP com ou sem acento, Dividendo, e sem data de pagamento fica de fora", () => {
    const html = page("<th>Data</th>", [
      ["21/08/2026", "0,6741", "JRS CAP PROPRIO", "23/11/2026 ", "1"],
      ["21/08/2026", "47,16", "DIVIDENDO", "21/12/2026", "100"],
      ["01/09/2026", "0,1", "JRS CAP PRÓPRIO", "11/09/2026", "1"],
      ["01/09/2026", "0,2", "Juros", "11/09/2026", "1"],
      ["21/12/2018", "0,7000", "JRS CAP PROPRIO", "-", "1"],
      ["01/02/2026", "1,0", "BONIFICACAO", "01/03/2026", "1"],
    ]);
    const result = parseFundamentusDividends(html, "acao")!;
    expect(result.map((item) => item.kind)).toEqual(["JCP", "DIVIDENDO", "JCP", "JCP"]);
    expect(result[1].perShare).toBeCloseTo(0.4716, 10);
    expect(result[0].payDate).toEqual(at("2026-11-23"));
  });

  it("sem a tabela (ticker desconhecido) é null; tabela vazia é lista vazia", () => {
    expect(parseFundamentusDividends("<html><body>nada</body></html>", "fii")).toBeNull();
    expect(parseFundamentusDividends(page("<th>x</th>", []), "acao")).toEqual([]);
  });
});

describe("datas e números do site", () => {
  it("lê dd/mm/aaaa e recusa o resto", () => {
    expect(parseBrDate("05/01/2026")).toEqual(at("2026-01-05"));
    expect(parseBrDate("-")).toBeNull();
    expect(parseBrDate("31/02/2026")).toBeNull();
  });
  it("lê 1.234,56 e recusa texto", () => {
    expect(parseBrNumber("1.234,56")).toBe(1234.56);
    expect(parseBrNumber("0,0242")).toBe(0.0242);
    expect(parseBrNumber("-")).toBeNull();
  });
});
