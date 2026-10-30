import { describe, expect, it } from "vitest";
import { dividendCheck, extractDividends, extractUpcoming } from "./dividends";
import type { EventoRow, MovementRow } from "./types";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const time = (iso: string) => day(iso).getTime();

const movement = (
  kind: string,
  code: string,
  iso: string,
  fields: Partial<MovementRow> = {},
): MovementRow => ({
  row: 0,
  credit: true,
  date: day(iso),
  kind,
  code,
  quantity: null,
  unitPrice: null,
  value: null,
  ...fields,
});

const evento = (code: string, eventType: string, fields: Partial<EventoRow> = {}): EventoRow => ({
  row: 0,
  code,
  eventType,
  payDate: null,
  quantity: null,
  unitPrice: null,
  value: null,
  ...fields,
});

// Os ativos do teste: o SNCI11 (e os códigos da família dele) e quatro ações.
const STOCKS = new Set(["PETR4", "BBAS3", "EGIE3", "ITSA4"]);
const tickerOf = (code: string) =>
  STOCKS.has(code) ? code : /^SNCI1[1-9]$/.test(code) ? "SNCI11" : null;
const isStock = (ticker: string) => STOCKS.has(ticker);
const period = { start: day("2019-11-01"), end: day("2026-10-30") };
type Timeline = Map<string, [number, number][]>;

describe("extractDividends: o tipo de cada linha da Movimentação", () => {
  const planned = extractDividends(
    [
      movement("Rendimento", "SNCI11", "2026-01-15", {
        quantity: 1000,
        unitPrice: 0.11,
        value: 110,
      }),
      movement("Rendimento", "SNCI13", "2026-01-15", { quantity: 100, unitPrice: 0.05, value: 5 }),
      movement("Dividendo", "BBAS3", "2023-06-12", {
        quantity: 100,
        unitPrice: 0.123,
        value: 12.3,
      }),
      movement("Juros Sobre Capital Próprio", "BBAS3", "2023-03-31", {
        quantity: 100,
        unitPrice: 0.352,
        value: 29.92,
      }),
      movement("Rendimento", "PETR4", "2026-05-20", {
        quantity: 100,
        unitPrice: 0.016,
        value: 1.28,
      }),
      movement("Reembolso", "PETR4", "2024-05-20", { quantity: 0, value: 144.38 }),
      movement("Empréstimo", "EGIE3", "2023-03-31", { quantity: 0, value: 1.94 }),
      // O "Empréstimo" que abre o contrato não tem valor.
      movement("Empréstimo", "EGIE3", "2023-03-31", { quantity: 100 }),
      movement("Rendimento - Transferido", "SNCI11", "2021-04-20", { quantity: 54, value: 32.86 }),
      movement("Dividendo", "BBAS3", "2023-06-12", { credit: false, quantity: 100, value: 12.3 }),
      movement("Dividendo", "CDB", "2023-06-12", { value: 1 }),
    ],
    period,
    tickerOf,
    () => true,
    [],
  );

  it("leva cada crédito ao tipo da B3, com o valor que ela mostra", () => {
    expect(planned.inserts.map((item) => [item.ticker, item.kind, item.amount])).toEqual([
      ["SNCI11", "RENDIMENTO", 110],
      ["SNCI11", "RENDIMENTO", 5],
      ["BBAS3", "DIVIDENDO", 12.3],
      ["BBAS3", "JCP", 29.92],
      ["PETR4", "RENDIMENTO", 1.28],
      ["PETR4", "REEMBOLSO", 144.38],
      ["EGIE3", "ALUGUEL", 1.94],
    ]);
  });

  it("no JCP, o valor é o líquido e o valor por ação, o bruto", () => {
    expect(planned.inserts.find((item) => item.kind === "JCP")).toMatchObject({
      amount: 29.92,
      quantity: 100,
      perShare: 0.352,
    });
  });

  it("o aluguel vem com a quantidade do contrato e sem valor por ação", () => {
    expect(planned.inserts.find((item) => item.kind === "ALUGUEL")).toMatchObject({
      quantity: 0,
      perShare: null,
    });
  });

  it("o escopo da troca tem os ativos dos proventos", () => {
    expect(planned.tickers).toEqual(["BBAS3", "EGIE3", "PETR4", "SNCI11"]);
  });
});

describe("extractUpcoming: o tipo de cada linha do Eventos", () => {
  it("dividendo, JCP e reembolsos das ações; rendimento dos FIIs", () => {
    const ignored: string[] = [];
    const upcoming = extractUpcoming(
      {
        rows: [
          evento("PETR4", "Reembolso - JUROS SOBRE CAPITAL PRÓPRIO", {
            payDate: day("2026-11-23"),
            unitPrice: 0.67,
            value: 55.61,
          }),
          evento("PETR4", "Reembolso - DIVIDENDO", {
            payDate: day("2026-12-21"),
            unitPrice: 0.47,
            value: 47.15,
          }),
          evento("EGIE3", "DIVIDENDO", { quantity: 139, unitPrice: 0.54, value: 75.64 }),
          evento("BBAS3", "JUROS SOBRE CAPITAL PRÓPRIO", {
            payDate: day("2026-12-10"),
            quantity: 200,
            unitPrice: 0.1,
            value: 17,
          }),
          evento("SNCI11", "RENDIMENTO", {
            payDate: day("2026-11-14"),
            quantity: 1000,
            unitPrice: 0.11,
            value: 110,
          }),
          evento("PETR4", "BONIFICAÇÃO EM ATIVOS", { value: 0 }),
        ],
        rowErrors: [],
      },
      day("2026-10-30"),
      tickerOf,
      (_reason, code) => ignored.push(code),
    );
    expect(
      upcoming.items.map((item) => [item.ticker, item.kind, item.payDate, item.amount]),
    ).toEqual([
      ["PETR4", "REEMBOLSO", day("2026-11-23"), 55.61],
      ["PETR4", "REEMBOLSO", day("2026-12-21"), 47.15],
      ["EGIE3", "DIVIDENDO", null, 75.64],
      ["BBAS3", "JCP", day("2026-12-10"), 17],
      ["SNCI11", "RENDIMENTO", day("2026-11-14"), 110],
    ]);
    expect(ignored).toEqual(["PETR4"]);
  });
});

describe("dividendCheck: ações", () => {
  it("acha a posição até um ano antes do pagamento (JCP pago depois da venda)", () => {
    const timeline: Timeline = new Map<string, [number, number][]>([
      [
        "ITSA4",
        [
          [time("2022-01-03"), 2310],
          [time("2022-12-28"), 0],
        ],
      ],
    ]);
    const check = dividendCheck({
      rows: [
        movement("Juros Sobre Capital Próprio", "ITSA4", "2023-10-02", {
          quantity: 2310,
          unitPrice: 0.052,
          value: 101.19,
        }),
      ],
      timeline,
      tickerOf,
      isStock,
      legs: [],
    });
    expect(check).toMatchObject({ months: 1, matched: 1, explained: [], unexplained: [] });
  });

  it("no FII, a janela continua de 45 dias", () => {
    const timeline: Timeline = new Map<string, [number, number][]>([
      [
        "SNCI11",
        [
          [time("2022-01-03"), 1000],
          [time("2022-12-28"), 0],
        ],
      ],
    ]);
    const check = dividendCheck({
      rows: [movement("Rendimento", "SNCI11", "2023-10-02", { quantity: 1000, value: 110 })],
      timeline,
      tickerOf,
      isStock,
      legs: [],
    });
    expect(check.unexplained).toHaveLength(1);
  });

  it("JCP e dividendo no mesmo dia, cada um sobre a posição inteira, batem", () => {
    const timeline: Timeline = new Map<string, [number, number][]>([
      ["BBAS3", [[time("2023-01-02"), 100]]],
    ]);
    const check = dividendCheck({
      rows: [
        movement("Juros Sobre Capital Próprio", "BBAS3", "2023-06-12", {
          quantity: 100,
          unitPrice: 0.654,
          value: 55.62,
        }),
        movement("Dividendo", "BBAS3", "2023-06-12", {
          quantity: 100,
          unitPrice: 0.123,
          value: 12.3,
        }),
      ],
      timeline,
      tickerOf,
      isStock,
      legs: [],
    });
    expect(check).toMatchObject({ months: 1, matched: 1 });
  });

  it("o mesmo provento em duas corretoras bate pela soma", () => {
    const timeline: Timeline = new Map<string, [number, number][]>([
      ["PETR4", [[time("2023-01-02"), 100]]],
    ]);
    const check = dividendCheck({
      rows: [
        movement("Dividendo", "PETR4", "2023-12-15", {
          quantity: 60,
          unitPrice: 0.575,
          value: 34.5,
        }),
        movement("Dividendo", "PETR4", "2023-12-15", { quantity: 40, unitPrice: 0.575, value: 23 }),
      ],
      timeline,
      tickerOf,
      isStock,
      legs: [],
    });
    expect(check).toMatchObject({ months: 1, matched: 1 });
  });

  it("com as ações alugadas, a diferença fica explicada pelo aluguel", () => {
    const timeline: Timeline = new Map<string, [number, number][]>([
      ["EGIE3", [[time("2023-01-02"), 139]]],
    ]);
    const check = dividendCheck({
      rows: [
        movement("Juros Sobre Capital Próprio", "EGIE3", "2026-05-20", {
          quantity: 0.2,
          unitPrice: 0.088,
          value: 0.01,
        }),
      ],
      timeline,
      tickerOf,
      isStock,
      legs: [
        {
          ticker: "EGIE3",
          out: day("2026-04-30"),
          outQuantity: 139,
          back: null,
          backQuantity: null,
        },
      ],
    });
    expect(check.explained).toEqual([
      {
        ticker: "EGIE3",
        month: "2026-05",
        official: 0.2,
        rebuilt: 139,
        reason: "ações alugadas (aluguel)",
      },
    ]);
  });
});
