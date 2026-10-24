import "server-only";
import { getTenant } from "@/features/auth/server";
import { getAssetSnapshots } from "@/features/market-data/server";
import { getMyDividends, getMyTransactions } from "@/features/transactions/server";
import { addMonths, currentMonthKey, monthRange } from "@/shared/lib/time";
import { traced } from "@/shared/lib/tracing";
import {
  isReportMonth,
  monthPurchases,
  reinvestmentHistory,
  reinvestmentMonths,
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
  async (requested: string | null): Promise<ReinvestmentView> => {
    const tenant = await getTenant(); // chama connection(): só em tempo de requisição
    const nowMonth = currentMonthKey(new Date());
    // A mesma regra da ação: AAAA-MM, de 2000-01 até o mês atual.
    const month = requested && isReportMonth(requested, nowMonth) ? requested : nowMonth;
    const [transactions, received, percents] = await Promise.all([
      getMyTransactions(),
      getMyDividends(),
      listReinvestmentPercents(tenant.portfolioId),
    ]);
    const purchases = monthPurchases(transactions, month);
    const assets = await getAssetSnapshots([...new Set(purchases.map((item) => item.ticker))]);
    const history = reinvestmentHistory({
      transactions,
      received,
      percents,
      months: monthRange(addMonths(nowMonth, -(HISTORY_MONTHS - 1)), nowMonth),
    });
    const [current] = reinvestmentHistory({ transactions, received, percents, months: [month] });
    return {
      month,
      months: reinvestmentMonths(transactions, received, nowMonth, month),
      current: current!,
      purchases: purchases.map((item) => ({
        ...item,
        name: assets.get(item.ticker)?.name ?? null,
        logoUrl: assets.get(item.ticker)?.logoUrl ?? null,
      })),
      history,
      last12: summarizeReinvestment(history.slice(-12)),
    };
  },
  (view) => ({
    "koinos.view.purchases": view.purchases.length,
    "koinos.view.months": view.months.length,
  }),
);
