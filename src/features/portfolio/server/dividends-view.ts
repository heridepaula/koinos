import "server-only";
import { connection } from "next/server";
import { getAssetClasses, getAssetSnapshots } from "@/features/market-data/server";
import type { DividendKind } from "@/features/transactions";
import {
  getMyDividendForecast,
  getMyDividends,
  getMyTransactions,
} from "@/features/transactions/server";
import { inClass, type ClassFilter } from "@/shared/lib/class-filter";
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
  undisclosedDividends,
  upcomingDividends,
} from "../domain/dividends";
import { traced } from "@/shared/lib/tracing";
import type { DividendsView } from "../domain/types";

const CHART_MONTHS = 24;

/**
 * Tela de proventos do usuário logado: recebidos (extratos da B3), a receber (a foto do extrato de
 * Eventos da B3, completada pelos anúncios do Yahoo) e os agrupamentos do histórico. O resultado é
 * um DTO sem ids internos.
 */
export const getDividendsView = traced(
  "view.dividends",
  async (
    filter: ClassFilter = "TODOS",
    kind: DividendKind | null = null,
  ): Promise<DividendsView> => {
    await connection(); // usa a hora atual: só em tempo de requisição
    const now = new Date();
    const [transactions, allReceived, allForecast] = await Promise.all([
      getMyTransactions(),
      getMyDividends(),
      getMyDividendForecast(),
    ]);
    const tickers = [
      ...new Set([
        ...transactions.map((entry) => entry.ticker),
        ...allReceived.map((item) => item.ticker),
        ...(allForecast?.items ?? []).map((item) => item.ticker),
      ]),
    ];
    const [assets, classes] = await Promise.all([
      getAssetSnapshots(tickers),
      getAssetClasses(tickers),
    ]);
    // A estimativa do Yahoo e o "não divulgado" são só de FIIs: na ação, o pagamento vem meses
    // depois da data ex e o JCP do Yahoo é bruto (spec ações, §6.4).
    const isFiiLike = (ticker: string) => classes.get(ticker) !== "ACAO";
    const ofClass = (ticker: string) => inClass(filter, classes.get(ticker) ?? null);
    const ofKind = (itemKind: DividendKind) => kind === null || itemKind === kind;
    // A conferência de "já pago" do Yahoo e o "não divulgado" olham todos os tipos da classe:
    // um FII alugado recebe Reembolso no lugar do Rendimento.
    const classReceived = allReceived.filter((item) => ofClass(item.ticker));
    const received = classReceived.filter((item) => ofKind(item.kind));
    const classForecast = allForecast && {
      ...allForecast,
      items: allForecast.items.filter((item) => ofClass(item.ticker)),
    };
    const forecast = classForecast && {
      ...classForecast,
      items: classForecast.items.filter((item) => ofKind(item.kind)),
    };
    // O Yahoo só estima Rendimento de FII (spec etapa 2, §6.2).
    const withYahoo = kind === null || kind === "RENDIMENTO";
    const meta = (ticker: string) => ({
      name: assets.get(ticker)?.name ?? null,
      logoUrl: assets.get(ticker)?.logoUrl ?? null,
    });

    const announcements = new Map(
      [...assets]
        .filter(([ticker]) => withYahoo && isFiiLike(ticker) && ofClass(ticker))
        .map(([ticker, asset]) => [ticker, asset.dividendAnnouncements]),
    );
    const upcoming = upcomingDividends({
      now,
      transactions,
      received: classReceived,
      announcements,
      forecast,
    });
    // O "não divulgado" olha o "a receber" de todos os tipos da classe: um FII alugado tem
    // Reembolso na previsão da B3 e não deve aparecer só porque o filtro é Rendimento.
    const classUpcoming =
      kind === null
        ? upcoming
        : upcomingDividends({
            now,
            transactions,
            received: classReceived,
            announcements,
            forecast: classForecast,
          });
    const undisclosed = withYahoo
      ? undisclosedDividends({
          now,
          transactions,
          received: classReceived.filter((item) => isFiiLike(item.ticker)),
          announcements,
          upcoming: classUpcoming,
        })
      : [];
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
        payByPassed: item.payBy !== null && item.payBy.getTime() < today.getTime(),
      })),
      undisclosed: undisclosed.map((item) => ({ ...item, ...meta(item.ticker) })),
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
      imported: allReceived.length > 0,
      forecastAsOf: forecast?.asOf ?? null,
    };
  },
  (view, filter = "TODOS", kind = null) => ({
    "koinos.view.upcoming": view.upcoming.length,
    "koinos.view.undisclosed": view.undisclosed.length,
    "koinos.view.months": view.byMonth.length,
    "koinos.view.fiis": view.byTicker.length,
    "koinos.view.class_filter": filter,
    "koinos.view.kind_filter": kind ?? "TODOS",
  }),
);
