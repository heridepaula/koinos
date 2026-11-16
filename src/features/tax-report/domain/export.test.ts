import { describe, expect, it } from "vitest";
import { reportToCopyText, reportToJson, TAX_DISCLAIMER } from "./export";
import { round2 } from "./format";
import type { FiscalYearReport } from "./types";

const GENERATED_AT = new Date("2026-04-10T15:00:00Z");

const report: FiscalYearReport = {
  year: 2025,
  positions: [
    {
      ticker: "HGLG11",
      assetClass: "FII",
      name: "CSHG Logística",
      cnpj: "11.728.688/0001-47",
      quantityPrevious: 10,
      costPrevious: 1500,
      quantity: 20,
      cost: 3300.5,
      averagePrice: 165.025,
      receita: { group: "07", code: "03", label: "Fundos: FII" },
      discrimination: "20 COTAS DE CSHG LOGÍSTICA (HGLG11), CNPJ 11.728.688/0001-47.",
      closedInYear: false,
      flags: [],
    },
    {
      ticker: "PETR4",
      assetClass: "ACAO",
      name: null,
      cnpj: null,
      quantityPrevious: 0,
      costPrevious: 0,
      quantity: 100,
      cost: 3500.25,
      averagePrice: 35.0025,
      receita: { group: "03", code: "01", label: "Ações" },
      discrimination: null,
      closedInYear: false,
      flags: ["PRECO_ESTIMADO"],
    },
  ],
  exempt: [
    {
      sourceKey: "11.728.688/0001-47",
      tickers: ["HGLG11"],
      cnpj: "11.728.688/0001-47",
      sheet: "ISENTO",
      receita: { group: "Isentos", code: "26", label: "Outros", needsCheck: true },
      net: 100.1,
      gross: 100.1,
      withheld: 0,
    },
  ],
  exclusive: [
    {
      sourceKey: "PETR4",
      tickers: ["PETR4"],
      cnpj: null,
      sheet: "EXCLUSIVA",
      receita: { group: "Exclusiva", code: "10", label: "JCP" },
      net: 85,
      gross: 100,
      withheld: 15,
    },
  ],
  unclassified: [
    { ticker: "PETR4", kind: "REEMBOLSO", month: "2025-05", amount: 12.34, reason: "REEMBOLSO" },
  ],
  apuration: {
    months: [
      {
        month: "2025-03",
        assetClass: "FII",
        sold: 5000,
        result: 400,
        exempt: false,
        lossCompensated: 100,
        taxableBase: 300,
        tax: 60,
        lossBalanceAfter: 0,
      },
    ],
    darf: [{ month: "2025-03", tax: 60, due: 60, carriedOut: 0 }],
    openingLoss: { FII: 100, ACAO: 0 },
  },
  closingLoss: { FII: 0, ACAO: 0 },
  findings: [
    {
      code: "CNPJ_AUSENTE",
      severity: "CRITICO",
      ticker: "PETR4",
      month: null,
      message: "PETR4 sem CNPJ.",
    },
  ],
};

describe("reportToJson", () => {
  const parsed = JSON.parse(reportToJson(report, GENERATED_AT));

  it("leva o ano, a data de geração e o aviso fixo", () => {
    expect(parsed.year).toBe(2025);
    expect(parsed.generatedAt).toBe("2026-04-10T15:00:00.000Z");
    expect(parsed.disclaimer).toBe(TAX_DISCLAIMER);
  });

  it("leva o relatório completo", () => {
    expect(parsed.positions).toHaveLength(2);
    expect(parsed.apuration.darf[0].due).toBe(60);
    expect(parsed.findings[0].code).toBe("CNPJ_AUSENTE");
  });

  it("não leva ids internos", () => {
    const raw = reportToJson(
      { ...report, positions: [{ ...report.positions[0], _id: "x", portfolioId: "p" } as never] },
      GENERATED_AT,
    );
    expect(raw).not.toMatch(/portfolioId|_id/);
  });
});

describe("reportToCopyText", () => {
  const text = reportToCopyText(report, GENERATED_AT);
  const lines = text.split("\n");

  it("começa pelo ano e termina com o aviso fixo", () => {
    expect(lines[0]).toContain("2025");
    expect(text).toContain(TAX_DISCLAIMER);
    expect(text).toContain("10/04/2026");
  });

  it("põe cada discriminação em uma linha", () => {
    const discrimination = report.positions[0].discrimination!;
    expect(lines.filter((line) => line.includes(discrimination))).toHaveLength(1);
    expect(text).toContain("discriminação pendente");
  });

  it("traz os totais por ficha somados ao centavo", () => {
    const bens = round2(3300.5 + 3500.25);
    expect(text).toContain(`Total em 31/12/2025: R$ 6.800,75`);
    expect(bens).toBe(6800.75);
    expect(text).toContain("Total isentos: R$ 100,10");
    expect(text).toContain("Total exclusiva (líquido): R$ 85,00");
    expect(text).toContain("bruto R$ 100,00");
    expect(text).toContain("retido R$ 15,00");
  });

  it("lista a apuração, o DARF e os achados", () => {
    expect(text).toContain("2025-03");
    expect(text).toContain("DARF 6015");
    expect(text).toContain("30/04/2025");
    expect(text).toContain("PETR4 sem CNPJ.");
  });
});
