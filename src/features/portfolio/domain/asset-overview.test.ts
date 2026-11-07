import { describe, expect, it } from "vitest";
import type { DividendEntry } from "@/features/transactions";
import {
  dailyChange,
  defaultPricePeriod,
  dividendMonths,
  priceSeries,
  pricePeriods,
  yieldOnCost12m,
  type PriceSeries,
} from "./asset-overview";
import { dividendPace } from "./dividends";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const now = d("2026-11-07");

describe("yieldOnCost12m", () => {
  const position = { averagePrice: 100, quantity: 10 };

  it("soma os 12 meses de calendário antes do mês atual", () => {
    const paid = [
      { paidAt: d("2025-11-15"), amount: 10 }, // primeiro mês da janela
      { paidAt: d("2026-10-31"), amount: 10 }, // último mês da janela
      { paidAt: d("2026-11-05"), amount: 99 }, // mês atual: fora
      { paidAt: d("2025-10-31"), amount: 99 }, // antes da janela: fora
    ];
    expect(yieldOnCost12m(paid, position, now)).toBeCloseTo(20 / 1000);
  });

  it("é null sem posição ou sem custo", () => {
    const paid = [{ paidAt: d("2026-10-01"), amount: 10 }];
    expect(yieldOnCost12m(paid, { averagePrice: 100, quantity: 0 }, now)).toBeNull();
    expect(yieldOnCost12m(paid, { averagePrice: 0, quantity: 10 }, now)).toBeNull();
  });

  it("é zero com posição e sem proventos na janela", () => {
    expect(yieldOnCost12m([], position, now)).toBe(0);
  });
});

describe("dividendMonths", () => {
  const entry = (paidAt: string, amount: number): DividendEntry => ({
    ticker: "HGLG11",
    paidAt: d(paidAt),
    kind: "RENDIMENTO",
    amount,
    quantity: 10,
    perShare: amount / 10,
  });
  const received = [
    entry("2025-10-31", 99), // antes da janela
    entry("2025-11-14", 11),
    entry("2026-03-13", 12),
    entry("2026-03-27", 1.5), // dois pagamentos no mesmo mês somam
    entry("2026-10-15", 13),
    entry("2026-11-05", 99), // mês atual: fora
  ];

  it("dá os 12 meses fechados, com zero nos meses sem provento", () => {
    const result = dividendMonths(received, now);
    expect(result.months.map((item) => item.month)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(result.months[0].amount).toBe(11);
    expect(result.months[1].amount).toBe(0);
    expect(result.months[4].amount).toBeCloseTo(13.5);
    expect(result.months[11].amount).toBe(13);
  });

  it("soma o mesmo que o ritmo dos proventos do dashboard", () => {
    const result = dividendMonths(received, now);
    expect(result.total).toBeCloseTo(37.5);
    expect(result.total).toBeCloseTo(dividendPace(now, received).last12m);
    expect(result.monthlyAverage).toBeCloseTo(37.5 / 12);
  });

  it("é zero sem proventos", () => {
    const result = dividendMonths([], now);
    expect(result.months).toHaveLength(12);
    expect(result.total).toBe(0);
  });
});

describe("dailyChange", () => {
  it("deriva o valor em R$ do preço e do percentual", () => {
    const result = dailyChange(110, 10);
    expect(result?.percent).toBe(10);
    expect(result?.amount).toBeCloseTo(10);
  });

  it("é null sem preço ou sem variação", () => {
    expect(dailyChange(null, 1)).toBeNull();
    expect(dailyChange(10, null)).toBeNull();
  });
});

describe("priceSeries", () => {
  const recentCloses = [
    { date: d("2026-11-05"), close: 157 },
    { date: d("2026-11-03"), close: 155 },
    { date: d("2026-11-04"), close: 156 },
  ];
  const monthlyCloses = new Map([
    ["2026-09", 150],
    ["2026-10", 152],
    ["2026-11", 154],
  ]);

  it("ordena os pontos e termina no preço atual, na data da cotação", () => {
    const series = priceSeries({
      monthlyCloses,
      recentCloses,
      quote: { price: 158.4, at: new Date("2026-11-06T17:00:00Z") },
    });
    expect(series.daily).toEqual([
      { key: "2026-11-03", close: 155 },
      { key: "2026-11-04", close: 156 },
      { key: "2026-11-05", close: 157 },
      { key: "2026-11-06", close: 158.4 },
    ]);
    // O mês da cotação leva o preço atual no lugar do fechamento guardado.
    expect(series.monthly.at(-1)).toEqual({ key: "2026-11", close: 158.4 });
    expect(series.monthly).toHaveLength(3);
  });

  it("troca o fechamento do dia da cotação pelo preço atual", () => {
    const series = priceSeries({
      monthlyCloses,
      recentCloses,
      quote: { price: 157.5, at: new Date("2026-11-05T15:00:00Z") },
    });
    expect(series.daily.at(-1)).toEqual({ key: "2026-11-05", close: 157.5 });
    expect(series.daily).toHaveLength(3);
  });

  it("não mexe na série com uma cotação mais velha que o último fechamento", () => {
    const series = priceSeries({
      monthlyCloses,
      recentCloses,
      quote: { price: 140, at: new Date("2026-11-02T15:00:00Z") },
    });
    expect(series.daily.at(-1)).toEqual({ key: "2026-11-05", close: 157 });
  });

  it("sem cotação, fica só com o que está guardado", () => {
    const series = priceSeries({ monthlyCloses: new Map(), recentCloses: [], quote: null });
    expect(series).toEqual({ daily: [], monthly: [] });
  });
});

describe("pricePeriods", () => {
  const monthly = (count: number) =>
    Array.from({ length: count }, (_, index) => {
      const date = new Date(Date.UTC(2026, 10 - (count - 1 - index), 1));
      return { key: date.toISOString().slice(0, 7), close: 100 + index };
    });
  const daily = [
    { key: "2026-09-30", close: 90 }, // mais de 31 dias: fora do 1M
    { key: "2026-10-20", close: 150 },
    { key: "2026-11-06", close: 165 },
  ];
  const ids = (series: PriceSeries) => pricePeriods(series, now).map((item) => item.id);

  it("só oferece os períodos que têm o que mostrar", () => {
    expect(ids({ daily: [], monthly: [] })).toEqual([]);
    expect(ids({ daily, monthly: [] })).toEqual(["1M"]);
    expect(ids({ daily: [], monthly: monthly(1) })).toEqual([]);
    expect(ids({ daily: [], monthly: monthly(5) })).toEqual(["6M"]);
    expect(ids({ daily: [], monthly: monthly(10) })).toEqual(["6M", "1A"]);
    expect(ids({ daily: [], monthly: monthly(30) })).toEqual(["6M", "1A", "5A"]);
    expect(ids({ daily, monthly: monthly(84) })).toEqual(["1M", "6M", "1A", "5A", "TUDO"]);
  });

  it("recorta cada período e calcula a variação do primeiro ao último ponto", () => {
    const periods = pricePeriods({ daily, monthly: monthly(30) }, now);
    const month = periods.find((item) => item.id === "1M")!;
    expect(month.points.map((point) => point.key)).toEqual(["2026-10-20", "2026-11-06"]);
    expect(month.change).toBeCloseTo(0.1);
    const year = periods.find((item) => item.id === "1A")!;
    expect(year.points).toHaveLength(13);
    expect(year.points[0].key).toBe("2025-11");
    expect(year.granularity).toBe("month");
  });

  it("abre em 1 ano quando há, senão no mensal mais longo, senão no 1M", () => {
    expect(defaultPricePeriod(pricePeriods({ daily, monthly: monthly(30) }, now))?.id).toBe("1A");
    expect(defaultPricePeriod(pricePeriods({ daily, monthly: monthly(5) }, now))?.id).toBe("6M");
    expect(defaultPricePeriod(pricePeriods({ daily, monthly: [] }, now))?.id).toBe("1M");
    expect(defaultPricePeriod([])).toBeNull();
  });
});
