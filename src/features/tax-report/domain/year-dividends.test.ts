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
  it("com bruto por cota e quantidade, o bruto continua líquido ÷ 0,85 e a faixa só confere", () => {
    // 100 ações × R$ 1,00 bruto = 100,00; líquido 85,00
    expect(grossUpJcp(85, 1, 100)).toEqual({ gross: 100, withheld: 15, offRange: false });
  });
  it("marca o líquido que não bate com 85% do bruto do extrato", () => {
    expect(grossUpJcp(80, 1, 100)).toEqual({ gross: 94.12, withheld: 14.12, offRange: true });
  });
  it("tolera o bruto por cota arredondado pela B3 (até 1% do líquido)", () => {
    // 3 ações, bruto por cota 0,3333 (arredondado): 3 × 0,3333 × 0,85 = 0,85; líquido 0,85
    expect(grossUpJcp(0.85, 0.3333, 3).offRange).toBe(false);
  });
});

describe("groupYearDividends", () => {
  const classes: Record<string, "FII" | "ACAO"> = { PETR4: "ACAO", HGLG11: "FII" };
  const cnpj = () => "33.000.167/0001-01";
  const run = (dividends: DividendEntry[]) =>
    groupYearDividends({
      year: 2025,
      dividends,
      cnpjOf: cnpj,
      classOf: (t) => classes[t] ?? null,
    });
  const sumNet = (r: ReturnType<typeof run>) =>
    Math.round(
      ([...r.exempt, ...r.exclusive].reduce((a, i) => a + i.net, 0) +
        r.unclassified.reduce((a, u) => a + u.amount, 0)) *
        100,
    ) / 100;

  it("a ficha depende de tipo e classe: pares fora do mapa vão para unclassified", () => {
    const r = run([
      pay("2025-03-10", { ticker: "PETR4", kind: "RENDIMENTO", amount: 1 }),
      pay("2025-03-11", { ticker: "HGLG11", kind: "DIVIDENDO", amount: 2 }),
      pay("2025-03-12", { ticker: "HGLG11", kind: "JCP", amount: 4 }),
      pay("2025-03-13", { ticker: "DESC3", kind: "DIVIDENDO", amount: 8 }),
      pay("2025-03-14", { ticker: "PETR4", kind: "DIVIDENDO", amount: 16 }),
    ]);
    expect(r.exempt).toHaveLength(1);
    expect(r.exclusive).toHaveLength(0);
    expect(r.unclassified.map((u) => [u.ticker, u.reason]).sort()).toEqual([
      ["DESC3", "SEM_CLASSE"],
      ["HGLG11", "TIPO_FORA_DA_FICHA"],
      ["HGLG11", "TIPO_FORA_DA_FICHA"],
      ["PETR4", "TIPO_FORA_DA_FICHA"],
    ]);
  });

  it("reembolso e aluguel carregam o motivo", () => {
    const r = run([
      pay("2025-05-11", { ticker: "PETR4", kind: "REEMBOLSO", amount: 1 }),
      pay("2025-05-12", { ticker: "PETR4", kind: "ALUGUEL", amount: 2 }),
    ]);
    expect(r.unclassified.map((u) => u.reason)).toEqual(["REEMBOLSO", "ALUGUEL"]);
  });

  it("nenhum centavo some: fichas (líquido) + unclassified = proventos pagos no ano", () => {
    const list = [
      pay("2025-03-10", { ticker: "PETR4", kind: "RENDIMENTO", amount: 1.01 }),
      pay("2025-03-11", { ticker: "HGLG11", kind: "DIVIDENDO", amount: 2.02 }),
      pay("2025-03-13", { ticker: "DESC3", kind: "DIVIDENDO", amount: 8.08 }),
      pay("2025-03-14", { ticker: "PETR4", kind: "DIVIDENDO", amount: 16.16 }),
      pay("2025-04-14", { ticker: "PETR4", kind: "JCP", amount: 85 }),
      pay("2025-06-14", { ticker: "HGLG11", kind: "RENDIMENTO", amount: 3.3 }),
      pay("2024-06-14", { ticker: "HGLG11", kind: "RENDIMENTO", amount: 99 }),
    ];
    expect(sumNet(run(list))).toBe(115.57);
  });

  it("o bruto do JCP é sempre líquido ÷ 0,85, mesmo com bruto por cota arredondado", () => {
    const r = run([
      pay("2025-04-14", {
        ticker: "PETR4",
        kind: "JCP",
        amount: 0.85,
        quantity: 3,
        perShare: 0.33,
      }),
    ]);
    expect(r.exclusive[0]).toMatchObject({ net: 0.85, gross: 1, withheld: 0.15 });
  });

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
