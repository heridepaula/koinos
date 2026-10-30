import { describe, expect, it } from "vitest";
import { lendingLegs } from "./lending";
import type { B3Trade, MovementRow } from "./types";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Linha de "Transferência - Liquidação": crédito é volta (ou compra), débito é saída (ou venda). */
const settlement = (code: string, credit: boolean, iso: string, quantity: number): MovementRow => ({
  row: 0,
  credit,
  date: day(iso),
  kind: "Transferência - Liquidação",
  code,
  quantity,
  unitPrice: null,
  value: null,
});

const trade = (ticker: string, type: "BUY" | "SELL", iso: string, quantity: number): B3Trade => ({
  row: 0,
  date: day(iso),
  type,
  ticker,
  quantity,
  unitPrice: 10,
});

describe("lendingLegs: liquidação de negócio não é aluguel", () => {
  it("soma os negócios do dia, fracionário incluso (ITSA4: 2.300 + 10 numa linha de 2.310)", () => {
    const legs = lendingLegs(
      [settlement("ITSA4", false, "2023-01-02", 2310)],
      [trade("ITSA4", "SELL", "2022-12-28", 2300), trade("ITSA4", "SELL", "2022-12-28", 10)],
    );
    expect(legs).toEqual([]);
  });

  it("aceita a liquidação no próprio dia (D+0)", () => {
    const legs = lendingLegs(
      [settlement("XPML11", true, "2023-11-01", 10)],
      [trade("XPML11", "BUY", "2023-11-01", 10)],
    );
    expect(legs).toEqual([]);
  });

  it("sem uma linha para a soma do dia, casa cada negócio sozinho", () => {
    const legs = lendingLegs(
      [settlement("BBSE3", true, "2023-01-04", 60), settlement("BBSE3", true, "2023-01-04", 40)],
      [trade("BBSE3", "BUY", "2023-01-02", 60), trade("BBSE3", "BUY", "2023-01-02", 40)],
    );
    expect(legs).toEqual([]);
  });

  it("depois de 7 dias, a linha já não liquida o negócio: é saída de aluguel", () => {
    const legs = lendingLegs(
      [settlement("PETR4", false, "2023-01-20", 100)],
      [trade("PETR4", "SELL", "2023-01-02", 100)],
    );
    expect(legs).toEqual([
      { ticker: "PETR4", out: day("2023-01-20"), outQuantity: 100, back: null, backQuantity: null },
    ]);
  });
});

describe("lendingLegs: pareamento das saídas e voltas", () => {
  it("a volta fecha a saída de mesma quantidade", () => {
    const legs = lendingLegs(
      [settlement("EGIE3", false, "2023-02-13", 100), settlement("EGIE3", true, "2023-02-28", 100)],
      [],
    );
    expect(legs).toEqual([
      {
        ticker: "EGIE3",
        out: day("2023-02-13"),
        outQuantity: 100,
        back: day("2023-02-28"),
        backQuantity: 100,
      },
    ]);
  });

  it("fecha a saída mais antiga; a outra continua alugada", () => {
    const legs = lendingLegs(
      [
        settlement("PETR4", false, "2024-01-10", 100),
        settlement("PETR4", false, "2024-02-10", 100),
        settlement("PETR4", true, "2024-03-10", 100),
      ],
      [],
    );
    expect(legs.map((leg) => [leg.out, leg.back])).toEqual([
      [day("2024-01-10"), day("2024-03-10")],
      [day("2024-02-10"), null],
    ]);
  });

  it("no mesmo dia, a volta vem antes da saída", () => {
    const legs = lendingLegs(
      [
        settlement("VALE3", false, "2024-01-10", 100),
        settlement("VALE3", false, "2024-02-01", 100),
        settlement("VALE3", true, "2024-02-01", 100),
      ],
      [],
    );
    expect(legs.map((leg) => [leg.out, leg.back])).toEqual([
      [day("2024-01-10"), day("2024-02-01")],
      [day("2024-02-01"), null],
    ]);
  });

  it("EGIE3: as 32 alugadas na bonificação voltaram 44 (+12)", () => {
    const legs = lendingLegs(
      [
        settlement("EGIE3", false, "2025-11-04", 32),
        settlement("EGIE3", false, "2025-11-06", 68),
        settlement("EGIE3", true, "2025-11-11", 32),
        settlement("EGIE3", false, "2025-11-13", 32),
        settlement("EGIE3", true, "2025-11-25", 32),
        settlement("EGIE3", false, "2025-11-28", 32),
        settlement("EGIE3", true, "2025-11-28", 68),
        settlement("EGIE3", true, "2025-12-02", 44),
      ],
      [],
    );
    expect(legs.filter((leg) => (leg.backQuantity ?? 0) > leg.outQuantity)).toEqual([
      {
        ticker: "EGIE3",
        out: day("2025-11-28"),
        outQuantity: 32,
        back: day("2025-12-02"),
        backQuantity: 44,
      },
    ]);
  });

  it("volta sem saída aberta é ignorada", () => {
    expect(lendingLegs([settlement("SNFF11", true, "2021-06-17", 1)], [])).toEqual([]);
  });

  it("ignora as outras linhas da Movimentação", () => {
    const transfer: MovementRow = {
      ...settlement("EGIE3", false, "2023-02-07", 100),
      kind: "Transferência",
    };
    expect(lendingLegs([transfer], [])).toEqual([]);
  });
});
