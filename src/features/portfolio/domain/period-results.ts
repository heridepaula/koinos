import { addMonths, currentMonthKey, todayTradeDate } from "@/shared/lib/time";
import type { PeriodResult } from "./types";

const DAY = 86_400_000;

type HeldPosition = { ticker: string; quantity: number; price: number | null };

/** Segunda-feira da semana de `now`, em São Paulo, como data de negócio. */
export function weekStart(now: Date): Date {
  const today = todayTradeDate(now);
  const sinceMonday = (today.getUTCDay() + 6) % 7;
  return new Date(today.getTime() - sinceMonday * DAY);
}

/**
 * L/P da semana, do mês e do ano só pela cotação: para cada posição aberta hoje, as cotas de hoje
 * × (cotação atual − fechamento de referência). Não conta proventos nem vendas, e uma compra
 * feita no meio do período entra como se as cotas já estivessem lá no começo.
 * - Semana: o último pregão antes da segunda-feira (os fechamentos diários recentes).
 * - Mês: o fechamento do mês anterior. Ano: o de dezembro do ano anterior.
 * Um FII sem cotação ou sem o fechamento de referência fica fora da conta e vai em `missing`.
 */
export function periodResults(input: {
  now: Date;
  positions: readonly HeldPosition[];
  monthlyCloses: ReadonlyMap<string, ReadonlyMap<string, number>>;
  recentCloses: ReadonlyMap<string, readonly { date: Date; close: number }[]>;
}): PeriodResult[] {
  const month = currentMonthKey(input.now);
  const monday = weekStart(input.now);
  const previousDecember = `${Number(month.slice(0, 4)) - 1}-12`;
  const references: {
    key: PeriodResult["key"];
    label: string;
    close: (ticker: string) => number | null;
  }[] = [
    {
      key: "semana",
      label: "Semana",
      close: (ticker) =>
        (input.recentCloses.get(ticker) ?? [])
          .filter((item) => item.date.getTime() < monday.getTime())
          .reduce<{ date: Date; close: number } | null>(
            (latest, item) => (!latest || item.date > latest.date ? item : latest),
            null,
          )?.close ?? null,
    },
    {
      key: "mes",
      label: "Mês",
      close: (ticker) => input.monthlyCloses.get(ticker)?.get(addMonths(month, -1)) ?? null,
    },
    {
      key: "ano",
      label: "Ano",
      close: (ticker) => input.monthlyCloses.get(ticker)?.get(previousDecember) ?? null,
    },
  ];
  const held = input.positions.filter((position) => position.quantity > 0);
  return references.map(({ key, label, close }) => {
    let value = 0;
    let base = 0;
    const missing: string[] = [];
    for (const position of held) {
      const reference = close(position.ticker);
      if (position.price === null || reference === null) {
        missing.push(position.ticker);
        continue;
      }
      value += position.quantity * (position.price - reference);
      base += position.quantity * reference;
    }
    return { key, label, value, pct: base > 0 ? value / base : null, missing: missing.sort() };
  });
}
