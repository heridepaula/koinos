import { describe, expect, it } from "vitest";
import type { DividendEntry } from "@/features/transactions";
import { grossUpJcp, groupYearDividends } from "./year-dividends";

const pay = (
  iso: string,
  p: Partial<DividendEntry> & Pick<DividendEntry, "ticker" | "kind" | "amount">,
): DividendEntry => ({
  paidAt: new Date(`${iso}T00:00:00Z`),
  quantity: null,
  perShare: null,
  ...p,
});

describe("grossUpJcp", () => {
  it("sem bruto por cota, recompõe o bruto e o retido a partir do líquido de 85%", () => {
    expect(grossUpJcp(85)).toEqual({ gross: 100, withheld: 15, offRange: false });
    expect(grossUpJcp(0.85)).toEqual({ gross: 1, withheld: 0.15, offRange: false });
  });
  it("com bruto por cota e quantidade, o bruto é o do extrato e confere os 85%", () => {
    // 100 ações × R$ 1,00 bruto = 100,00; líquido 85,00
    expect(grossUpJcp(85, 1, 100)).toEqual({ gross: 100, withheld: 15, offRange: false });
  });
  it("marca o líquido que não bate com 85% do bruto do extrato", () => {
    expect(grossUpJcp(80, 1, 100)).toMatchObject({ gross: 100, withheld: 20, offRange: true });
  });
});

describe("groupYearDividends", () => {
  const cnpjOf = (t: string) =>
    t.startsWith("PETR") ? "33.000.167/0001-01" : t === "SEMCNPJ3" ? null : "00.000.000/0001-91";
  const classOf = (t: string) => (t.endsWith("11") ? ("FII" as const) : ("ACAO" as const));

  it("agrupa por fonte e ficha e ignora outros anos", () => {
    const r = groupYearDividends({
      year: 2025,
      dividends: [
        pay("2025-03-10", { ticker: "PETR3", kind: "DIVIDENDO", amount: 10 }),
        pay("2025-04-10", { ticker: "PETR4", kind: "DIVIDENDO", amount: 5.5 }),
        pay("2024-12-31", { ticker: "PETR4", kind: "DIVIDENDO", amount: 99 }),
        pay("2025-06-10", { ticker: "HGLG11", kind: "RENDIMENTO", amount: 7.25 }),
        pay("2025-05-10", { ticker: "PETR4", kind: "JCP", amount: 85 }),
        pay("2025-05-11", { ticker: "PETR4", kind: "REEMBOLSO", amount: 1 }),
        pay("2025-05-12", { ticker: "PETR4", kind: "ALUGUEL", amount: 2 }),
      ],
      cnpjOf,
      classOf,
    });
    expect(r.exempt).toHaveLength(2);
    const petr = r.exempt.find((i) => i.cnpj === "33.000.167/0001-01")!;
    expect(petr.net).toBeCloseTo(15.5, 6);
    expect(petr.tickers.sort()).toEqual(["PETR3", "PETR4"]);
    expect(petr.receita.code).toBe("09");
    const fii = r.exempt.find((i) => i.tickers[0] === "HGLG11")!;
    expect(fii.receita).toMatchObject({ code: "26", needsCheck: true });
    expect(r.exclusive).toHaveLength(1);
    expect(r.exclusive[0]).toMatchObject({ net: 85, gross: 100, withheld: 15 });
    expect(r.unclassified.map((u) => u.kind).sort()).toEqual(["ALUGUEL", "REEMBOLSO"]);
  });

  it("sem CNPJ a chave é o ticker", () => {
    const r = groupYearDividends({
      year: 2025,
      dividends: [pay("2025-03-10", { ticker: "SEMCNPJ3", kind: "DIVIDENDO", amount: 3 })],
      cnpjOf,
      classOf,
    });
    expect(r.exempt[0]).toMatchObject({ sourceKey: "SEMCNPJ3", cnpj: null });
  });

  it("devolve os tickers de JCP fora da faixa", () => {
    const r = groupYearDividends({
      year: 2025,
      // 100 ações × R$ 1,00 bruto = 100,00, mas o líquido guardado é 80,00 (devia ser 85,00)
      dividends: [
        pay("2025-03-10", { ticker: "PETR4", kind: "JCP", amount: 80, quantity: 100, perShare: 1 }),
      ],
      cnpjOf,
      classOf,
    });
    expect(r.jcpOffRange).toEqual(["PETR4"]);
  });
});
