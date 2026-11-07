/** Cálculos puros da página de detalhes do ativo (spec 2026-11-07-detalhes-do-ativo). */
import {
  addMonths,
  currentMonthKey,
  monthKeyOfTradeDate,
  monthRange,
  toIsoDate,
  todayTradeDate,
} from "@/shared/lib/time";

type PaidDividend = { paidAt: Date; amount: number };

/**
 * Os 12 meses fechados antes do mês atual (São Paulo): a mesma janela do ritmo dos proventos do
 * dashboard (`dividendPace`), para o yield on cost e as barras falarem do mesmo período.
 */
function closedYear(now: Date): { first: string; current: string } {
  const current = currentMonthKey(now);
  return { first: addMonths(current, -12), current };
}

const inClosedYear = (window: { first: string; current: string }, paidAt: Date) => {
  const key = monthKeyOfTradeDate(paidAt);
  return key >= window.first && key < window.current;
};

/**
 * Yield on cost: proventos recebidos nos 12 meses fechados antes do mês atual, divididos pelo
 * custo médio da posição (preço médio × cotas). Null sem posição ou sem custo.
 */
export function yieldOnCost12m(
  dividends: readonly PaidDividend[],
  position: { averagePrice: number; quantity: number },
  now: Date,
): number | null {
  const cost = position.averagePrice * position.quantity;
  if (position.quantity <= 0 || cost <= 0) return null;
  const window = closedYear(now);
  const received = dividends
    .filter((item) => inClosedYear(window, item.paidAt))
    .reduce((sum, item) => sum + item.amount, 0);
  return received / cost;
}

export type DividendMonths = {
  /** Os 12 meses fechados, do mais antigo ao mais recente, com zero nos meses sem provento. */
  months: { month: string; amount: number }[];
  /** A soma das barras: o total dos 12 meses. */
  total: number;
  monthlyAverage: number;
};

/** Proventos de um ativo por mês, nos 12 meses fechados (a janela do yield on cost). */
export function dividendMonths(dividends: readonly PaidDividend[], now: Date): DividendMonths {
  const window = closedYear(now);
  const totals = new Map<string, number>();
  for (const item of dividends) {
    if (!inClosedYear(window, item.paidAt)) continue;
    const key = monthKeyOfTradeDate(item.paidAt);
    totals.set(key, (totals.get(key) ?? 0) + item.amount);
  }
  const months = monthRange(window.first, addMonths(window.current, -1)).map((month) => ({
    month,
    amount: totals.get(month) ?? 0,
  }));
  const total = months.reduce((sum, item) => sum + item.amount, 0);
  return { months, total, monthlyAverage: total / months.length };
}

/**
 * Variação do dia em R$ por cota e em fração, a partir do preço e do `changePercent` da cotação,
 * que é guardado em fração (0,0115 = 1,15%), como os adaptadores da brapi e do Yahoo gravam.
 */
export function dailyChange(
  price: number | null,
  changePercent: number | null,
): { amount: number; percent: number } | null {
  if (price === null || changePercent === null) return null;
  const previous = price / (1 + changePercent);
  return { amount: price - previous, percent: changePercent };
}

/** Um ponto do gráfico de cotação: `key` é o dia (AAAA-MM-DD) ou o mês (AAAA-MM). */
export type PricePoint = { key: string; close: number };

export type PriceSeries = { daily: PricePoint[]; monthly: PricePoint[] };

const byKey = (a: PricePoint, b: PricePoint) => a.key.localeCompare(b.key);

/**
 * Termina a série no preço atual, na data da cotação: troca o ponto dessa data ou acrescenta um.
 * Uma cotação mais velha que o último fechamento guardado não mexe na série.
 */
function endingAtQuote(points: PricePoint[], key: string, close: number): PricePoint[] {
  const last = points.at(-1);
  if (last && last.key > key) return points;
  return [...points.filter((point) => point.key < key), { key, close }];
}

/**
 * As séries do gráfico: os fechamentos diários recentes e os mensais guardados, cada uma terminando
 * no preço atual, na data em que ele foi cotado (no fim de semana, a cotação é a de sexta).
 */
export function priceSeries(input: {
  monthlyCloses: ReadonlyMap<string, number>;
  recentCloses: readonly { date: Date; close: number }[];
  quote: { price: number; at: Date } | null;
}): PriceSeries {
  const daily = input.recentCloses
    .map(({ date, close }) => ({ key: toIsoDate(date), close }))
    .sort(byKey);
  const monthly = [...input.monthlyCloses].map(([key, close]) => ({ key, close })).sort(byKey);
  if (!input.quote) return { daily, monthly };
  const { price, at } = input.quote;
  return {
    daily: daily.length > 0 ? endingAtQuote(daily, toIsoDate(todayTradeDate(at)), price) : daily,
    monthly: endingAtQuote(monthly, currentMonthKey(at), price),
  };
}

export type PricePeriodId = "1M" | "6M" | "1A" | "5A" | "TUDO";

export type PricePeriod = {
  id: PricePeriodId;
  label: string;
  granularity: "day" | "month";
  points: PricePoint[];
  /** Último ÷ primeiro − 1; null quando o primeiro é zero. */
  change: number | null;
};

const MONTHLY_PERIODS = [
  { id: "6M", months: 6 },
  { id: "1A", months: 12 },
  { id: "5A", months: 60 },
] as const;

const DAY_MS = 86_400_000;

function period(
  id: PricePeriodId,
  label: string,
  granularity: PricePeriod["granularity"],
  points: PricePoint[],
): PricePeriod {
  const first = points[0].close;
  const last = points[points.length - 1].close;
  return { id, label, granularity, points, change: first > 0 ? last / first - 1 : null };
}

/**
 * Os períodos que o gráfico oferece, só os que têm o que mostrar: 1M com os fechamentos diários; 6M,
 * 1A e 5A com os mensais, cada um só quando tem mais pontos que o anterior; e Tudo quando o
 * histórico passa do maior deles. Um período precisa de dois pontos.
 */
export function pricePeriods(series: PriceSeries, now: Date): PricePeriod[] {
  const periods: PricePeriod[] = [];
  const monthAgo = toIsoDate(new Date(todayTradeDate(now).getTime() - 31 * DAY_MS));
  const lastMonth = series.daily.filter((point) => point.key >= monthAgo);
  if (lastMonth.length >= 2) periods.push(period("1M", "1M", "day", lastMonth));
  const current = currentMonthKey(now);
  let shown = 1;
  for (const { id, months } of MONTHLY_PERIODS) {
    const from = addMonths(current, -months);
    const points = series.monthly.filter((point) => point.key >= from);
    if (points.length >= 2 && points.length > shown) {
      periods.push(period(id, id, "month", points));
      shown = points.length;
    }
  }
  if (series.monthly.length >= 2 && series.monthly.length > shown) {
    periods.push(period("TUDO", "Tudo", "month", series.monthly));
  }
  return periods;
}

/** O período que o gráfico abre: 1 ano quando há, senão o mensal mais longo, senão 1M. */
export function defaultPricePeriod(periods: readonly PricePeriod[]): PricePeriod | null {
  return (
    periods.find((item) => item.id === "1A") ??
    periods.findLast((item) => item.granularity === "month") ??
    periods[0] ??
    null
  );
}
