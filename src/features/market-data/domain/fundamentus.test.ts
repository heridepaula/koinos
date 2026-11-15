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

describe("parseFundamentusDividends com a página danificada", () => {
  const head = "<th>Última Data Com</th>";

  it("a mesma linha repetida (tabela duplicada, linha dobrada) conta uma vez", () => {
    const row = ["30/10/2026", "Rendimento", "16/11/2026", "1,17"];
    const once = parseFundamentusDividends(page(head, [row]), "fii");
    expect(parseFundamentusDividends(page(head, [row, row, row]), "fii")).toEqual(once);
    // Valor ou data diferente é outro evento.
    const other = parseFundamentusDividends(
      page(head, [row, ["30/10/2026", "Rendimento", "16/11/2026", "1,18"]]),
      "fii",
    );
    expect(other).toHaveLength(2);
  });

  it("colunas trocadas não viram provento: a linha é descartada, não lida errado", () => {
    // Valor no lugar da data e data no lugar do valor.
    const swapped = page(head, [["1,17", "Rendimento", "16/11/2026", "30/10/2026"]]);
    expect(parseFundamentusDividends(swapped, "fii")).toEqual([]);
    // Tipo e pagamento trocados.
    const kindSwapped = page(head, [["30/10/2026", "16/11/2026", "Rendimento", "1,17"]]);
    expect(parseFundamentusDividends(kindSwapped, "fii")).toEqual([]);
  });

  it("valores corrompidos (texto, vazio, zero, negativo, escala quebrada) ficam de fora", () => {
    const rows = ["abc", "", "-", "0,00", "-1,17", "1,17,5", "1.23,4", "R$"].map((value) => [
      "30/10/2026",
      "Rendimento",
      "16/11/2026",
      value,
    ]);
    expect(parseFundamentusDividends(page(head, rows), "fii")).toEqual([]);
  });

  it("ação com lote zero, vazio ou ilegível não divide por zero", () => {
    const rows = ["0", "", "x", "-100"].map((lot) => [
      "21/08/2026",
      "47,16",
      "DIVIDENDO",
      "21/12/2026",
      lot,
    ]);
    expect(parseFundamentusDividends(page("<th>Data</th>", rows), "acao")).toEqual([]);
  });

  it("linha com menos colunas do que a página exige é ignorada, e as boas seguem", () => {
    const html = page(head, [
      ["30/10/2026", "Rendimento"],
      ["30/10/2026", "Rendimento", "16/11/2026", "1,17"],
      [],
    ]);
    expect(parseFundamentusDividends(html, "fii")).toHaveLength(1);
  });

  it("HTML quebrado: tabela sem fechar, tag aberta na célula, entidades, página vazia", () => {
    const open = `<table id="resultado"><tbody><tr><td>30/10/2026</td><td>Rendimento</td><td>16/11/2026</td><td>1,17`;
    expect(parseFundamentusDividends(open, "fii")).toBeNull();
    expect(parseFundamentusDividends("", "fii")).toBeNull();
    const entity = page(head, [["30/10/2026", "Rendimento", "&nbsp;16/11/2026&nbsp;", "1,17"]]);
    expect(parseFundamentusDividends(entity, "fii")).toHaveLength(1);
    const tags = page(head, [
      ["<b>30/10/2026</b>", "<i>Rendimento</i>", "16/11/2026", "<span>1,17</span>"],
    ]);
    expect(parseFundamentusDividends(tags, "fii")).toHaveLength(1);
  });

  it("o valor por ação na escala de milhar do site (1.500,00 por 1.000 ações)", () => {
    const html = page("<th>Data</th>", [
      ["21/08/2026", "1.500,00", "DIVIDENDO", "21/12/2026", "1.000"],
    ]);
    expect(parseFundamentusDividends(html, "acao")![0].perShare).toBe(1.5);
  });
});

describe("parseBrNumber no formato do site", () => {
  it("o ponto de milhar não vira decimal, e o decimal em inglês não vira milhar", () => {
    expect(parseBrNumber("1.500")).toBe(1500);
    expect(parseBrNumber("1,50")).toBe(1.5);
    expect(parseBrNumber("R$ 1.500,00")).toBe(1500);
    expect(parseBrNumber("1234.56")).toBe(1234.56);
    expect(parseBrNumber("1.5")).toBe(1.5);
  });
});
