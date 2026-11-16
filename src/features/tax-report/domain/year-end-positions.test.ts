import { describe, expect, it } from "vitest";
import type { LedgerEntry } from "@/features/transactions";
import type { AssetIdentity } from "./types";
import { buildAssetPositions, discriminationOf } from "./year-end-positions";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
let seq = 0;
function entry(
  p: Partial<LedgerEntry> &
    Pick<LedgerEntry, "ticker" | "type" | "quantity" | "unitPrice" | "date">,
): LedgerEntry & { priceSource?: "ESTIMADO" | null } {
  seq += 1;
  return { id: `e${seq}`, fees: 0, createdAt: new Date(2020, 0, 1, 0, 0, seq), ...p };
}

const ident = (cnpj: string | null): AssetIdentity => ({
  name: "Empresa Teste S.A.",
  legalName: "EMPRESA TESTE S.A.",
  cnpj,
  cnpjSource: cnpj ? "MANUAL" : null,
});

const classes = new Map([
  ["TEST3", "ACAO" as const],
  ["TSTF11", "FII" as const],
]);

describe("buildAssetPositions", () => {
  it("custo inclui taxas e a coluna anterior é a foto do ano passado", () => {
    const entries = [
      entry({
        ticker: "TEST3",
        type: "BUY",
        quantity: 100,
        unitPrice: 10,
        fees: 5,
        date: day("2024-03-01"),
      }),
      entry({
        ticker: "TEST3",
        type: "BUY",
        quantity: 100,
        unitPrice: 12,
        fees: 0,
        date: day("2025-03-01"),
      }),
    ];
    const [p] = buildAssetPositions({
      year: 2025,
      entries,
      assetClasses: classes,
      identities: new Map([["TEST3", ident("33.000.167/0001-01")]]),
    });
    expect(p.quantityPrevious).toBe(100);
    expect(p.costPrevious).toBeCloseTo(1005, 6);
    expect(p.quantity).toBe(200);
    expect(p.cost).toBeCloseTo(2205, 6);
    expect(p.averagePrice).toBeCloseTo(11.025, 6);
    expect(p.receita).toMatchObject({ group: "03", code: "01" });
  });

  it("venda parcial baixa o custo pelo preço médio", () => {
    const entries = [
      entry({
        ticker: "TEST3",
        type: "BUY",
        quantity: 100,
        unitPrice: 10,
        date: day("2025-01-10"),
      }),
      entry({
        ticker: "TEST3",
        type: "SELL",
        quantity: 40,
        unitPrice: 15,
        date: day("2025-02-10"),
      }),
    ];
    const [p] = buildAssetPositions({
      year: 2025,
      entries,
      assetClasses: classes,
      identities: new Map(),
    });
    expect(p.quantity).toBe(60);
    expect(p.cost).toBeCloseTo(600, 6);
    expect(p.quantityPrevious).toBe(0);
  });

  it("posição zerada no ano é 'encerrada no ano' e não tem discriminação", () => {
    const entries = [
      entry({
        ticker: "TSTF11",
        type: "BUY",
        quantity: 10,
        unitPrice: 100,
        date: day("2024-05-01"),
      }),
      entry({
        ticker: "TSTF11",
        type: "SELL",
        quantity: 10,
        unitPrice: 110,
        date: day("2025-05-01"),
      }),
    ];
    const [p] = buildAssetPositions({
      year: 2025,
      entries,
      assetClasses: classes,
      identities: new Map([["TSTF11", ident("33.000.167/0001-01")]]),
    });
    expect(p.closedInYear).toBe(true);
    expect(p.quantity).toBe(0);
    expect(p.discrimination).toBeNull();
    expect(p.receita).toMatchObject({ group: "07", code: "03" });
  });

  it("ignora o que não existia em nenhuma das duas datas", () => {
    const entries = [
      entry({ ticker: "TEST3", type: "BUY", quantity: 5, unitPrice: 10, date: day("2026-02-01") }),
    ];
    expect(
      buildAssetPositions({ year: 2025, entries, assetClasses: classes, identities: new Map() }),
    ).toEqual([]);
  });

  it("marca preço estimado e posição anterior", () => {
    const entries = [
      entry({
        ticker: "TEST3",
        type: "BUY",
        quantity: 10,
        unitPrice: 10,
        date: day("2019-11-07"),
        kind: "POSICAO_ANTERIOR",
      }),
      {
        ...entry({
          ticker: "TEST3",
          type: "BUY",
          quantity: 10,
          unitPrice: 10,
          date: day("2024-01-01"),
        }),
        priceSource: "ESTIMADO" as const,
      },
    ];
    const [p] = buildAssetPositions({
      year: 2025,
      entries,
      assetClasses: classes,
      identities: new Map(),
    });
    expect(p.flags).toEqual(["PRECO_ESTIMADO", "POSICAO_ANTERIOR"]);
  });
});

describe("discriminationOf", () => {
  it("monta o modelo da spec, sem corretora", () => {
    expect(
      discriminationOf({
        assetClass: "ACAO",
        quantity: 200,
        name: "Petróleo Brasileiro S.A.",
        ticker: "PETR4",
        cnpj: "33.000.167/0001-01",
        cost: 2205,
        averagePrice: 11.025,
      }),
    ).toBe(
      "200 AÇÕES DE PETRÓLEO BRASILEIRO S.A. (PETR4), CNPJ 33.000.167/0001-01. CUSTO TOTAL DE AQUISIÇÃO: R$ 2.205,00 (PREÇO MÉDIO DE R$ 11,025).",
    );
  });
  it("FII usa COTAS e sem CNPJ devolve null", () => {
    const base = {
      assetClass: "FII" as const,
      quantity: 3,
      name: "Fundo X",
      ticker: "XPTO11",
      cost: 300,
      averagePrice: 100,
    };
    expect(discriminationOf({ ...base, cnpj: "33.000.167/0001-01" })).toContain(
      "3 COTAS DE FUNDO X (XPTO11)",
    );
    expect(discriminationOf({ ...base, cnpj: null })).toBeNull();
  });
});
