import { describe, expect, it } from "vitest";
import type { DividendEntry, LedgerEntry } from "@/features/transactions";
import { auditReport } from "./audit";
import type { ApurationMonth, AssetFiscalPosition, FiscalClass } from "./types";
import type { YearDividends } from "./year-dividends";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const CNPJ = "11222333000181";

const position = (p: Partial<AssetFiscalPosition> = {}): AssetFiscalPosition => ({
  ticker: "TEST3",
  assetClass: "ACAO",
  name: "Teste",
  cnpj: CNPJ,
  quantityPrevious: 0,
  costPrevious: 0,
  quantity: 100,
  cost: 1000,
  averagePrice: 10,
  receita: { group: "03", code: "01", label: "Ações" },
  discrimination: "texto",
  closedInYear: false,
  flags: [],
  ...p,
});

const noDividends: YearDividends = { exempt: [], exclusive: [], unclassified: [], jcpOffRange: [] };

const classOf = (t: string): FiscalClass | null => (t.endsWith("11") ? "FII" : "ACAO");

type Input = Parameters<typeof auditReport>[0];
const run = (over: Partial<Input> = {}) =>
  auditReport({
    year: 2025,
    positions: [],
    dividends: noDividends,
    rawDividends: [],
    entries: [],
    months: [],
    openingLossInformed: true,
    classOf,
    cnpjOf: () => CNPJ,
    ...over,
  });

const codes = (over: Partial<Input> = {}) => run(over).map((f) => f.code);

describe("auditReport", () => {
  it("sem nada a apontar, não devolve achados", () => {
    expect(run({ positions: [position()] })).toEqual([]);
  });

  it("CNPJ_AUSENTE é crítico, uma vez por ticker, vindo da ficha de Bens", () => {
    const r = run({ positions: [position({ cnpj: null }), position({ cnpj: null })] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ code: "CNPJ_AUSENTE", severity: "CRITICO", ticker: "TEST3" });
  });

  it("CNPJ_AUSENTE também vem de provento sem CNPJ, sem repetir o ticker da posição", () => {
    const item = {
      sourceKey: "ABCD11",
      tickers: ["ABCD11", "TEST3"],
      cnpj: null,
      sheet: "ISENTO" as const,
      receita: { group: "09", code: "99", label: "x" },
      net: 10,
      gross: 10,
      withheld: 0,
    };
    const r = run({
      positions: [position({ cnpj: null })],
      dividends: { ...noDividends, exempt: [item] },
    });
    expect(r.filter((f) => f.code === "CNPJ_AUSENTE").map((f) => f.ticker)).toEqual([
      "ABCD11",
      "TEST3",
    ]);
  });

  it("PRECO_ESTIMADO e POSICAO_ANTERIOR são informativos", () => {
    const r = run({ positions: [position({ flags: ["PRECO_ESTIMADO", "POSICAO_ANTERIOR"] })] });
    expect(r.map((f) => [f.code, f.severity, f.ticker])).toEqual([
      ["PRECO_ESTIMADO", "INFO", "TEST3"],
      ["POSICAO_ANTERIOR", "INFO", "TEST3"],
    ]);
  });

  it("SALDO_PREJUIZO_NAO_INFORMADO só quando o saldo não foi informado", () => {
    expect(codes({ openingLossInformed: false })).toEqual(["SALDO_PREJUIZO_NAO_INFORMADO"]);
    expect(codes({ openingLossInformed: true })).toEqual([]);
  });

  it("reembolso e aluguel viram achados de atenção com ticker e mês", () => {
    const r = run({
      dividends: {
        ...noDividends,
        unclassified: [
          {
            ticker: "TEST3",
            kind: "REEMBOLSO",
            month: "2025-05",
            amount: 12.5,
            reason: "REEMBOLSO",
          },
          { ticker: "ALUG3", kind: "ALUGUEL", month: "2025-06", amount: 3, reason: "ALUGUEL" },
        ],
      },
    });
    expect(r.map((f) => [f.code, f.severity, f.ticker, f.month])).toEqual([
      ["PROVENTO_REEMBOLSO", "ATENCAO", "TEST3", "2025-05"],
      ["ALUGUEL_NAO_CLASSIFICADO", "ATENCAO", "ALUG3", "2025-06"],
    ]);
    expect(r[0].message).toContain("12,50");
  });

  it("sem classe e tipo fora da ficha viram PROVENTO_NAO_CLASSIFICADO", () => {
    const r = run({
      dividends: {
        ...noDividends,
        unclassified: [
          { ticker: "SEMC3", kind: "DIVIDENDO", month: "2025-05", amount: 7, reason: "SEM_CLASSE" },
          {
            ticker: "HGLG11",
            kind: "JCP",
            month: "2025-06",
            amount: 3,
            reason: "TIPO_FORA_DA_FICHA",
          },
        ],
      },
    });
    expect(r.map((f) => [f.code, f.severity, f.ticker, f.month])).toEqual([
      ["PROVENTO_NAO_CLASSIFICADO", "ATENCAO", "SEMC3", "2025-05"],
      ["PROVENTO_NAO_CLASSIFICADO", "ATENCAO", "HGLG11", "2025-06"],
    ]);
    expect(r[0].message).toContain("7,00");
    expect(r[0].message).toContain("2025-05");
  });

  it("JCP_FORA_DA_FAIXA: um achado por ticker", () => {
    const r = run({ dividends: { ...noDividends, jcpOffRange: ["AAAA3", "BBBB3"] } });
    expect(r.map((f) => [f.code, f.ticker])).toEqual([
      ["JCP_FORA_DA_FAIXA", "AAAA3"],
      ["JCP_FORA_DA_FAIXA", "BBBB3"],
    ]);
  });

  describe("RETENCAO_DIVIDENDO_POSSIVEL", () => {
    const div = (amount: number, iso: string, ticker = "TEST3"): DividendEntry => ({
      ticker,
      paidAt: day(iso),
      kind: "DIVIDENDO",
      amount,
      quantity: null,
      perShare: null,
    });

    it("não vale antes de 2026", () => {
      expect(codes({ year: 2025, rawDividends: [div(60_000, "2025-05-10")] })).toEqual([]);
    });

    it("2026: acima de R$ 50.000 da mesma fonte no mês", () => {
      const r = run({
        year: 2026,
        classOf: () => "ACAO",
        // duas ações da mesma fonte (mesmo CNPJ): 30.000 + 20.000,01
        rawDividends: [div(30_000, "2026-05-10", "TEST3"), div(20_000.01, "2026-05-20", "TEST4")],
      });
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ code: "RETENCAO_DIVIDENDO_POSSIVEL", month: "2026-05" });
    });

    it("2026: exatamente R$ 50.000, fontes diferentes ou meses diferentes não alertam", () => {
      const r = run({
        year: 2026,
        classOf: () => "ACAO",
        cnpjOf: (t) => (t === "OUTRA3" ? "99888777000100" : CNPJ),
        rawDividends: [
          div(50_000, "2026-05-10"),
          div(30_000, "2026-06-10"),
          div(30_000, "2026-06-11", "OUTRA3"),
        ],
      });
      expect(r).toEqual([]);
    });

    it("2026: FII e JCP não entram na soma", () => {
      const r = run({
        year: 2026,
        rawDividends: [
          { ...div(60_000, "2026-05-10", "ABCD11"), kind: "RENDIMENTO" },
          { ...div(60_000, "2026-05-10"), kind: "JCP" },
        ],
      });
      expect(r).toEqual([]);
    });
  });

  describe("DAY_TRADE_NAO_APURADO", () => {
    const e = (
      type: "BUY" | "SELL",
      iso: string,
      ticker = "TEST3",
      kind?: LedgerEntry["kind"],
    ): LedgerEntry => ({
      id: `${type}${iso}${ticker}`,
      ticker,
      type,
      quantity: 10,
      unitPrice: 10,
      fees: 0,
      date: day(iso),
      createdAt: day(iso),
      kind,
    });

    it("compra e venda do mesmo ticker no mesmo dia", () => {
      const r = run({ entries: [e("BUY", "2025-03-10"), e("SELL", "2025-03-10")] });
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({
        code: "DAY_TRADE_NAO_APURADO",
        severity: "ATENCAO",
        ticker: "TEST3",
        month: "2025-03",
      });
    });

    it("dias diferentes, tickers diferentes, outro ano ou compra não-negócio não contam", () => {
      expect(
        codes({
          entries: [
            e("BUY", "2025-03-09"),
            e("SELL", "2025-03-10"),
            e("BUY", "2025-04-10", "OUTRA3"),
            e("SELL", "2025-04-10"),
            e("BUY", "2024-05-10"),
            e("SELL", "2024-05-10"),
            e("BUY", "2025-06-10", "TEST3", "BONIFICACAO"),
            e("SELL", "2025-06-10"),
          ],
        }),
      ).toEqual([]);
    });
  });

  it("VENDA_ACIMA_ISENCAO: só mês de ação não isento com imposto", () => {
    const month = (over: Partial<ApurationMonth>): ApurationMonth => ({
      month: "2025-03",
      assetClass: "ACAO",
      sold: 30_000,
      result: 10_000,
      exempt: false,
      lossCompensated: 0,
      taxableBase: 10_000,
      tax: 1500,
      lossBalanceAfter: 0,
      ...over,
    });
    const r = run({
      months: [
        month({}),
        month({ month: "2025-04", exempt: true, tax: 0 }),
        month({ month: "2025-05", assetClass: "FII" }),
        month({ month: "2025-06", tax: 0 }),
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ code: "VENDA_ACIMA_ISENCAO", severity: "INFO", month: "2025-03" });
  });
});
