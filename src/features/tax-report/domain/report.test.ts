import { describe, expect, it } from "vitest";
import { replayLedger, type DividendEntry } from "@/features/transactions";
import { round2 } from "./format";
import { buildFiscalYearReport } from "./report";
import type { AssetIdentity, FiscalClass } from "./types";
import type { TaxLedgerEntry } from "./year-end-positions";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
let seq = 0;
const entry = (
  p: Pick<TaxLedgerEntry, "ticker" | "type" | "quantity" | "unitPrice" | "date"> &
    Partial<TaxLedgerEntry>,
): TaxLedgerEntry => {
  seq += 1;
  return { id: `e${seq}`, fees: 0, createdAt: new Date(2020, 0, 1, 0, 0, seq), ...p };
};
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const assetClasses = new Map<string, FiscalClass>([
  ["TEST3", "ACAO"],
  ["TSTF11", "FII"],
]);
const identities = new Map<string, AssetIdentity>([
  [
    "TEST3",
    {
      name: "Teste",
      legalName: "TESTE S.A.",
      cnpj: "11222333000181",
      cnpjSource: "MANUAL",
      subType: null,
    },
  ],
  ["TSTF11", { name: "Fundo", legalName: null, cnpj: null, cnpjSource: null, subType: null }],
]);

// Cenário de 2025: compra de 400 TEST3 a 100 (40.000), venda de 300 a 120 em março (vendido 36.000,
// custo 30.000, lucro 6.000, acima dos R$ 20 mil), dividendo, JCP e reembolso de TEST3 e rendimento
// do fundo. O dividendo de 2024 fica fora do ano.
const entries: TaxLedgerEntry[] = [
  entry({ ticker: "TEST3", type: "BUY", quantity: 400, unitPrice: 100, date: day("2025-01-10") }),
  entry({ ticker: "TEST3", type: "SELL", quantity: 300, unitPrice: 120, date: day("2025-03-10") }),
  entry({ ticker: "TSTF11", type: "BUY", quantity: 10, unitPrice: 10, date: day("2025-02-10") }),
];
const div = (
  ticker: string,
  iso: string,
  kind: DividendEntry["kind"],
  amount: number,
): DividendEntry => ({ ticker, paidAt: day(iso), kind, amount, quantity: null, perShare: null });
const dividends: DividendEntry[] = [
  div("TEST3", "2025-04-15", "DIVIDENDO", 100),
  div("TEST3", "2025-08-15", "JCP", 85),
  div("TSTF11", "2025-05-15", "RENDIMENTO", 7.5),
  div("TEST3", "2025-06-15", "REEMBOLSO", 2.25),
  div("TEST3", "2024-12-15", "DIVIDENDO", 999),
];

const build = (openingLoss: { FII: number; ACAO: number } | null, year = 2025) =>
  buildFiscalYearReport({
    year,
    entries,
    dividends: year === 2025 ? dividends : [],
    assetClasses,
    identities,
    openingLoss,
  });
const report = build(null);

describe("buildFiscalYearReport", () => {
  it("as fichas mais o que ficou de fora fecham com os proventos do ano", () => {
    const fichas = sum(report.exempt.map((i) => i.net)) + sum(report.exclusive.map((i) => i.net));
    const out = sum(report.unclassified.map((u) => u.amount));
    // 100 + 85 + 7,5 + 2,25 = 194,75
    expect(round2(fichas + out)).toBe(
      round2(sum(dividends.filter((d) => d.paidAt.getUTCFullYear() === 2025).map((d) => d.amount))),
    );
    expect(round2(fichas + out)).toBe(194.75);
  });

  it("a apuração do ano sem saldo inicial soma o resultado das vendas", () => {
    const total = sum(report.apuration.months.map((m) => m.result));
    expect(total).toBeCloseTo(sum(replayLedger(entries).sales.map((s) => s.proceeds - s.cost)), 6);
    expect(total).toBe(6000);
  });

  it("calcula o imposto do mês acima da isenção e o DARF", () => {
    expect(report.apuration.months).toHaveLength(1);
    expect(report.apuration.months[0]).toMatchObject({
      month: "2025-03",
      assetClass: "ACAO",
      sold: 36_000,
      exempt: false,
      taxableBase: 6000,
      tax: 900,
    });
    expect(report.apuration.darf).toEqual([
      { month: "2025-03", tax: 900, due: 900, carriedOut: 0 },
    ]);
    expect(report.closingLoss).toEqual({ FII: 0, ACAO: 0 });
  });

  it("a ficha de Bens traz as duas posições em 31/12", () => {
    const byTicker = Object.fromEntries(report.positions.map((p) => [p.ticker, p]));
    expect(byTicker.TEST3).toMatchObject({ quantity: 100, cost: 10_000 });
    expect(byTicker.TSTF11).toMatchObject({ quantity: 10, cost: 100 });
  });

  it("junta os achados: saldo não informado, CNPJ do fundo, reembolso e venda acima da isenção", () => {
    const found = report.findings.map((f) => `${f.code}:${f.ticker ?? "-"}`);
    expect(found).toContain("SALDO_PREJUIZO_NAO_INFORMADO:-");
    expect(found).toContain("CNPJ_AUSENTE:TSTF11");
    expect(found).toContain("PROVENTO_REEMBOLSO:TEST3");
    expect(found).toContain("VENDA_ACIMA_ISENCAO:-");
    expect(found).not.toContain("CNPJ_AUSENTE:TEST3");
  });

  it("com saldo informado, compensa e some o achado", () => {
    const r = build({ FII: 0, ACAO: 1000 });
    expect(r.apuration.months[0]).toMatchObject({
      lossCompensated: 1000,
      taxableBase: 5000,
      tax: 750,
    });
    expect(r.apuration.openingLoss).toEqual({ FII: 0, ACAO: 1000 });
    expect(r.findings.map((f) => f.code)).not.toContain("SALDO_PREJUIZO_NAO_INFORMADO");
  });

  it("um ano sem vendas não tem meses de apuração", () => {
    expect(build(null, 2026).apuration.months).toEqual([]);
  });
});
