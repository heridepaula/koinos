import { describe, expect, it } from "vitest";
import { assetHeat, HEAT, heatLevel, rsi } from "./asset-heat";
import { closesWithQuote, type WeekMove } from "./week-move";

const day = (month: number, d: number) => new Date(Date.UTC(2026, month - 1, d));
const series = (closes: readonly number[]) =>
  closes.map((close, i) => ({ date: new Date(Date.UTC(2026, 9, 1 + i)), close }));
const move = (change: number, over: Partial<WeekMove> = {}): WeekMove => ({
  change,
  from: day(11, 6),
  bucket: "estavel",
  index: null,
  reading: null,
  ...over,
});

describe("rsi", () => {
  it("só altas dá 100; só quedas, 0; parado, 50", () => {
    expect(rsi(Array.from({ length: 15 }, (_, i) => 10 + i))).toBe(100);
    expect(rsi(Array.from({ length: 15 }, (_, i) => 30 - i))).toBe(0);
    expect(rsi(Array.from({ length: 15 }, () => 10))).toBe(50);
  });

  it("altas de 1 e quedas de 0,5 alternadas: média de ganho o dobro da de perda, 66,7", () => {
    const closes = [10];
    for (let i = 0; i < 14; i++) closes.push(closes.at(-1)! + (i % 2 === 0 ? 1 : -0.5));
    expect(rsi(closes)).toBeCloseTo(100 - 100 / 3, 6);
  });

  it("suaviza como Wilder depois dos 14 primeiros; com menos de 15 pontos, null", () => {
    const closes = [...Array.from({ length: 15 }, (_, i) => 10 + i), 23];
    // depois de 14 altas de 1, uma queda de 1: ganho 13/14, perda 1/14
    expect(rsi(closes)).toBeCloseTo(100 - 100 / (1 + 13), 6);
    expect(rsi(Array.from({ length: 14 }, (_, i) => i))).toBeNull();
  });
});

describe("heatLevel", () => {
  it("as bordas dos cinco níveis", () => {
    expect(heatLevel(0)).toBe("medo-extremo");
    expect(heatLevel(19)).toBe("medo-extremo");
    expect(heatLevel(20)).toBe("medo");
    expect(heatLevel(39)).toBe("medo");
    expect(heatLevel(40)).toBe("neutro");
    expect(heatLevel(60)).toBe("neutro");
    expect(heatLevel(61)).toBe("otimismo");
    expect(heatLevel(80)).toBe("otimismo");
    expect(heatLevel(81)).toBe("euforia");
    expect(heatLevel(100)).toBe("euforia");
  });
});

describe("assetHeat", () => {
  const flat = series(Array.from({ length: 21 }, () => 100));

  it("tudo parado: neutro, 50, sem o componente das notícias", () => {
    const heat = assetHeat({
      ticker: "HGLG11",
      series: flat,
      assetClass: "FII",
      move: move(0),
      tone: null,
    })!;
    expect(heat).toMatchObject({ score: 50, level: "neutro", label: "Neutro" });
    expect(heat.factors.map((factor) => [factor.id, factor.score])).toEqual([
      ["semana", 50],
      ["ifr", 50],
      ["media", 50],
    ]);
  });

  it("as notícias pesam 15%: desfavoráveis puxam para 46", () => {
    const heat = assetHeat({
      ticker: "HGLG11",
      series: flat,
      assetClass: "FII",
      move: move(0),
      tone: "desfavoravel",
    })!;
    expect(heat.score).toBe(Math.round(0.3 * 50 + 0.3 * 50 + 0.25 * 50 + 0.15 * 20));
    expect(heat.factors.at(-1)).toMatchObject({
      id: "noticias",
      score: HEAT.newsScore.desfavoravel,
      detail: "Tom das notícias da semana: desfavorável.",
    });
    expect(
      assetHeat({
        ticker: "X",
        series: flat,
        assetClass: "FII",
        move: move(0),
        tone: "sem_fato",
      })?.factors.map((factor) => factor.id),
    ).not.toContain("noticias");
  });

  it("o TRXF11 de 13/11: medo extremo", () => {
    const closes = [
      [10, 14, 70.2],
      [10, 15, 70.1],
      [10, 16, 69.8],
      [10, 17, 70.4],
      [10, 20, 69.9],
      [10, 21, 70],
      [10, 22, 69.5],
      [10, 23, 69.7],
      [10, 24, 69.4],
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
    const heat = assetHeat({
      ticker: "TRXF11",
      series: closesWithQuote(closes, { price: 55.41, session: day(11, 13) }),
      assetClass: "FII",
      move: move(55.41 / 63.5 - 1, { bucket: "queda-forte" }),
      tone: "desfavoravel",
    })!;
    expect(heat.level).toBe("medo-extremo");
    expect(heat.label).toBe("Medo extremo");
    expect(heat.score).toBeLessThan(20);
    expect(heat.factors.find((factor) => factor.id === "semana")).toMatchObject({
      score: 0,
      detail: "Em 7 dias, o TRXF11 caiu 12,74%.",
    });
    expect(heat.factors.find((factor) => factor.id === "media")?.detail).toMatch(
      /^Preço \d+,\d% abaixo da média dos últimos 20 pregões\.$/,
    );
  });

  it("alta forte com notícias favoráveis: euforia", () => {
    const rising = series(Array.from({ length: 21 }, (_, i) => 100 + i));
    const heat = assetHeat({
      ticker: "XPML11",
      series: rising,
      assetClass: "FII",
      move: move(0.08, { bucket: "alta-forte" }),
      tone: "favoravel",
    })!;
    expect(heat.level).toBe("euforia");
  });

  it("a semana conta contra o índice: cair junto com o IFIX é neutro", () => {
    const heat = assetHeat({
      ticker: "KNRI11",
      series: flat,
      assetClass: "FII",
      move: move(-0.03, {
        bucket: "queda",
        index: { id: "IFIX", change: -0.03 },
        reading: "acompanhou",
      }),
      tone: null,
    })!;
    expect(heat.factors[0]).toMatchObject({ id: "semana", score: 50 });
  });

  it("ação usa a faixa de 10%: cair 5% na semana dá 25", () => {
    const heat = assetHeat({
      ticker: "PETR4",
      series: flat,
      assetClass: "ACAO",
      move: move(-0.05, { bucket: "queda" }),
      tone: null,
    })!;
    expect(heat.factors[0].score).toBe(25);
  });

  it("menos de dois componentes de preço: sem termômetro", () => {
    expect(
      assetHeat({
        ticker: "X",
        series: series([1, 2, 3, 4, 5]),
        assetClass: "FII",
        move: null,
        tone: "favoravel",
      }),
    ).toBeNull();
    // 12 pontos: só a média (o IFR pede 15) e sem a semana
    expect(
      assetHeat({
        ticker: "X",
        series: series(Array.from({ length: 12 }, () => 10)),
        assetClass: "FII",
        move: null,
        tone: null,
      }),
    ).toBeNull();
  });
});
