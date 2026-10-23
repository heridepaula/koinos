import "server-only";
import { connection } from "next/server";
import { getAssetSnapshots } from "@/features/market-data/server";
import { getMyDividends, getMyTransactions } from "@/features/transactions/server";
import {
  addMonths,
  currentMonthKey,
  monthKeyOfTradeDate,
  monthRange,
  todayTradeDate,
} from "@/shared/lib/time";
import {
  groupByMonth,
  groupByTicker,
  groupByYear,
  monthSummary,
  upcomingDividends,
} from "../domain/dividends";
import type { DividendsView } from "../domain/types";

const CHART_MONTHS = 24;

/**
 * Tela de proventos do usuário logado: recebidos (extratos da B3), a receber (anúncios do Yahoo)
 * e os agrupamentos do histórico. O resultado é um DTO sem ids internos.
 */
export async function getDividendsView(): Promise<DividendsView> {
  await connection(); // usa a hora atual: só em tempo de requisição
  const now = new Date();
  const [transactions, received] = await Promise.all([getMyTransactions(), getMyDividends()]);
  const tickers = [
    ...new Set([
      ...transactions.map((entry) => entry.ticker),
      ...received.map((item) => item.ticker),
    ]),
  ];
  const assets = await getAssetSnapshots(tickers);
  const meta = (ticker: string) => ({
    name: assets.get(ticker)?.name ?? null,
    logoUrl: assets.get(ticker)?.logoUrl ?? null,
  });

  const announcements = new Map(
    [...assets].map(([ticker, asset]) => [ticker, asset.dividendAnnouncements]),
  );
  const upcoming = upcomingDividends({ now, transactions, received, announcements });
  const today = todayTradeDate(now);

  const byMonth = groupByMonth(received);
  const totals = new Map(byMonth.map((group) => [group.month, group.total]));
  const nowMonth = currentMonthKey(now);
  const first = received.reduce<Date | null>(
    (earliest, item) => (!earliest || item.paidAt < earliest ? item.paidAt : earliest),
    null,
  );

  return {
    month: monthSummary(now, received, upcoming),
    upcoming: upcoming.map((item) => ({
      ...item,
      ...meta(item.ticker),
      payByPassed: item.payBy.getTime() < today.getTime(),
    })),
    byMonth,
    byYear: groupByYear(received),
    byTicker: groupByTicker(received).map((item) => ({ ...item, ...meta(item.ticker) })),
    chart: monthRange(addMonths(nowMonth, -(CHART_MONTHS - 1)), nowMonth).map((month) => ({
      month,
      amount: totals.get(month) ?? 0,
    })),
    since: first ? monthKeyOfTradeDate(first) : null,
    // Sem nenhum provento importado não dá para saber o que já foi pago: todo anúncio pareceria
    // "a receber". A tela mostra só o convite para importar os extratos.
    imported: received.length > 0,
  };
}
