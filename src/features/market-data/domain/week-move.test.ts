import { describe, expect, it } from "vitest";
import {
  changeOverDays,
  closesWithQuote,
  moveBucket,
  weekMoveFacts,
  weekMoveKey,
  weekMoveOf,
  weekMoveText,
  type WeekMove,
} from "./week-move";

const day = (month: number, d: number) => new Date(Date.UTC(2026, month - 1, d));

// Fechamentos reais do TRXF11 (produção, 2026-11-13) e a cotação de sexta, 13/11.
const TRXF11 = [
  [10, 27, 69.01],
  [10, 28, 65.5],
  [10, 29, 67.38],
  [10, 30, 66.45],
  [11, 3, 62.8],
  [11, 4, 62.8],
  [11, 5, 64.9],
  [11, 6, 63.5],
  [11, 9, 59],
  [11, 10, 57.5],
  [11, 11, 57.01],
  [11, 12, 54.4],
].map(([m, d, close]) => ({ date: day(m, d), close }));
const QUOTE = { price: 55.41, session: day(11, 13) };

describe("closesWithQuote", () => {
  it("acrescenta o preço atual no pregão da cotação", () => {
    const series = closesWithQuote(TRXF11, QUOTE);
    expect(series).toHaveLength(13);
    expect(series.at(-1)).toEqual({ date: day(11, 13), close: 55.41 });
  });

  it("a cotação substitui o fechamento do mesmo pregão; sem cotação, só os fechamentos em ordem", () => {
    const series = closesWithQuote(TRXF11, { price: 55, session: day(11, 12) });
    expect(series.at(-1)).toEqual({ date: day(11, 12), close: 55 });
    expect(series).toHaveLength(12);
    expect(closesWithQuote([...TRXF11].reverse(), null)).toEqual(TRXF11);
  });
});

describe("changeOverDays", () => {
  it("contra o último fechamento até 7 dias antes: a sexta anterior", () => {
    const week = changeOverDays(closesWithQuote(TRXF11, QUOTE));
    expect(week?.from).toEqual(day(11, 6));
    expect(week?.change).toBeCloseTo(55.41 / 63.5 - 1, 10);
  });

  it("sem fechamento de 7 dias antes, null", () => {
    expect(changeOverDays(closesWithQuote(TRXF11.slice(-4), QUOTE))).toBeNull();
    expect(changeOverDays([])).toBeNull();
  });
});

describe("moveBucket", () => {
  it("FII: estável abaixo de 1,5%; forte a partir de 5%, nos dois sentidos", () => {
    expect(moveBucket(-0.0149, "FII")).toBe("estavel");
    expect(moveBucket(-0.015, "FII")).toBe("queda");
    expect(moveBucket(-0.0499, "FII")).toBe("queda");
    expect(moveBucket(-0.05, "FII")).toBe("queda-forte");
    expect(moveBucket(0.015, "FII")).toBe("alta");
    expect(moveBucket(0.05, "FII")).toBe("alta-forte");
  });

  it("ação (e sem classe): estável abaixo de 2,5%; forte a partir de 8%", () => {
    expect(moveBucket(0.0249, "ACAO")).toBe("estavel");
    expect(moveBucket(0.025, "ACAO")).toBe("alta");
    expect(moveBucket(-0.08, "ACAO")).toBe("queda-forte");
    expect(moveBucket(0.07, null)).toBe("alta");
  });
});

describe("weekMoveOf", () => {
  const ifix = (closes: [number, number, number][]) => ({
    id: "IFIX" as const,
    closes: closes.map(([m, d, close]) => ({ session: day(m, d), close })),
  });

  it("o TRXF11 sem histórico do índice: só o ativo, queda forte", () => {
    const move = weekMoveOf({
      closes: TRXF11,
      quote: QUOTE,
      assetClass: "FII",
      index: ifix([[11, 13, 3600]]),
    });
    expect(move).toMatchObject({ bucket: "queda-forte", index: null, reading: null });
  });

  it("com o índice dos mesmos pregões: a variação dele e a leitura com piso de 2 p.p.", () => {
    const move = weekMoveOf({
      closes: TRXF11,
      quote: QUOTE,
      assetClass: "FII",
      index: ifix([
        [11, 6, 3650],
        [11, 12, 3567.01],
        [11, 13, 3600],
      ]),
    });
    expect(move?.index?.id).toBe("IFIX");
    expect(move?.index?.change).toBeCloseTo(3600 / 3650 - 1, 10);
    expect(move?.reading).toBe("descolou");
  });

  it("índice sem o pregão da cotação não entra; sem referência do ativo, null", () => {
    const stale = weekMoveOf({
      closes: TRXF11,
      quote: QUOTE,
      assetClass: "FII",
      index: ifix([
        [11, 6, 3650],
        [11, 12, 3567.01],
      ]),
    });
    expect(stale?.index).toBeNull();
    expect(
      weekMoveOf({ closes: TRXF11.slice(-3), quote: QUOTE, assetClass: "FII", index: null }),
    ).toBeNull();
  });
});

const move = (over: Partial<WeekMove> = {}): WeekMove => ({
  change: -0.1274,
  from: day(11, 6),
  bucket: "queda-forte",
  index: null,
  reading: null,
  ...over,
});

describe("weekMoveKey", () => {
  it("faixa e leitura; sem movimento, vazia", () => {
    expect(weekMoveKey(move())).toBe("queda-forte:sem-indice");
    expect(weekMoveKey(move({ index: { id: "IFIX", change: -0.014 }, reading: "descolou" }))).toBe(
      "queda-forte:descolou",
    );
    expect(weekMoveKey(null)).toBe("");
  });
});

describe("weekMoveText", () => {
  it("sem índice, só o ativo", () => {
    expect(weekMoveText("TRXF11", move())).toBe("Em 7 dias, o TRXF11 caiu 12,74%.");
  });

  it("com o índice, a comparação", () => {
    const withIndex = move({ index: { id: "IFIX", change: -0.014 }, reading: "descolou" });
    expect(weekMoveText("TRXF11", withIndex)).toBe(
      "Em 7 dias, o IFIX caiu 1,40% e o TRXF11 caiu 12,74%, bem diferente do mercado.",
    );
    const along = move({
      change: 0.021,
      bucket: "alta",
      index: { id: "IBOV", change: 0.015 },
      reading: "acompanhou",
    });
    expect(weekMoveText("PETR4", along)).toBe(
      "Em 7 dias, o Ibovespa subiu 1,50% e o PETR4 subiu 2,10%, acompanhando o mercado.",
    );
  });
});

describe("weekMoveFacts", () => {
  it("em palavras, sem números de preço", () => {
    const facts = weekMoveFacts(move(), "FII");
    expect(facts).toBe(
      "Preço em 7 dias: caiu forte. IFIX, o índice dos fundos imobiliários, no período: sem dado.",
    );
    expect(facts).not.toMatch(/%|R\$|\d+,\d/);
  });

  it("com o índice e a leitura", () => {
    const facts = weekMoveFacts(
      move({ index: { id: "IFIX", change: -0.014 }, reading: "descolou" }),
      "FII",
    );
    expect(facts).toBe(
      "Preço em 7 dias: caiu forte. IFIX, o índice dos fundos imobiliários, no período: caiu pouco. O ativo se moveu bem diferente do mercado.",
    );
    const stock = weekMoveFacts(
      move({
        change: 0.01,
        bucket: "estavel",
        index: { id: "IBOV", change: 0.031 },
        reading: "descolou",
      }),
      "ACAO",
    );
    expect(stock).toContain("Preço em 7 dias: ficou estável.");
    expect(stock).toContain("Ibovespa, o índice das ações, no período: subiu forte.");
  });

  it("sem movimento calculado", () => {
    expect(weekMoveFacts(null, "ACAO")).toBe("Preço em 7 dias: sem dado.");
  });
});
