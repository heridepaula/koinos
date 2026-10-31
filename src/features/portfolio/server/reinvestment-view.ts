import "server-only";
import { getTenant } from "@/features/auth/server";
import { getAssetClasses, getAssetSnapshots } from "@/features/market-data/server";
import { getMyDividends, getMyTransactions } from "@/features/transactions/server";
import { byClass, type ClassFilter } from "@/shared/lib/class-filter";
import { addMonths, currentMonthKey, monthRange } from "@/shared/lib/time";
import { traced } from "@/shared/lib/tracing";
import {
  isReportMonth,
  monthPurchases,
  reinvestmentHistory,
  reinvestmentMonths,
  shareReinvestment,
  summarizeReinvestment,
} from "../domain/reinvestment";
import type { ReinvestmentView } from "../domain/types";
import { listReinvestmentPercents } from "./reinvestment-repo";

const HISTORY_MONTHS = 24;

/**
 * Tela de reinvestimento do usuário logado. `requested` vem da URL (?mes=); inválido ou futuro
 * cai no mês atual. O resultado é um DTO sem ids internos.
 */
export const getReinvestmentView = traced(
  "view.reinvestment",
  async (requested: string | null, filter: ClassFilter = "TODOS"): Promise<ReinvestmentView> => {
    const tenant = await getTenant(); // chama connection(): só em tempo de requisição
    const nowMonth = currentMonthKey(new Date());
    // A mesma regra da ação: AAAA-MM, de 2000-01 até o mês atual.
    const month = requested && isReportMonth(requested, nowMonth) ? requested : nowMonth;
    const [transactions, received, percents] = await Promise.all([
      getMyTransactions(),
      getMyDividends(),
      listReinvestmentPercents(tenant.portfolioId),
    ]);
    const classes =
      filter === "TODOS" ? null : await getAssetClasses(transactions.map((entry) => entry.ticker));
    const own = classes
      ? byClass(transactions, (ticker) => classes.get(ticker) ?? null, filter)
      : transactions;
    // Cada mês: a conta da carteira toda e, numa classe, a parte dela (rateio pelo aporte).
    const scoped = (months: string[]) => {
      const totals = reinvestmentHistory({ transactions, received, percents, months });
      if (!classes) return totals;
      const mine = reinvestmentHistory({ transactions: own, received: [], percents, months });
      return totals.map((total, index) => shareReinvestment(total, mine[index]!));
    };
    const purchases = monthPurchases(own, month);
    const assets = await getAssetSnapshots([...new Set(purchases.map((item) => item.ticker))]);
    const history = scoped(monthRange(addMonths(nowMonth, -(HISTORY_MONTHS - 1)), nowMonth));
    // `current` é o mês da carteira toda: a prévia da % refaz a conta no cliente e rateia.
    const [current] = reinvestmentHistory({ transactions, received, percents, months: [month] });
    const [mine] = classes
      ? reinvestmentHistory({ transactions: own, received: [], percents, months: [month] })
      : [];
    return {
      month,
      months: reinvestmentMonths(transactions, received, nowMonth, month),
      current: current!,
      currentClass: mine ? { aporte: mine.aporte, purchaseCount: mine.purchaseCount } : null,
      purchases: purchases.map((item) => ({
        ...item,
        name: assets.get(item.ticker)?.name ?? null,
        logoUrl: assets.get(item.ticker)?.logoUrl ?? null,
      })),
      history,
      last12: summarizeReinvestment(history.slice(-12)),
    };
  },
  (view, _requested, filter = "TODOS") => ({
    "koinos.view.purchases": view.purchases.length,
    "koinos.view.months": view.months.length,
    "koinos.view.class_filter": filter,
  }),
);
