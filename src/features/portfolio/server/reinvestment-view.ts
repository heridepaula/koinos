import "server-only";
import { getTenant } from "@/features/auth/server";
import { getAssetSnapshots } from "@/features/market-data/server";
import { getMyDividends, getMyTransactions } from "@/features/transactions/server";
import { addMonths, currentMonthKey, monthRange } from "@/shared/lib/time";
import {
  monthPurchases,
  reinvestmentHistory,
  reinvestmentMonths,
  summarizeReinvestment,
} from "../domain/reinvestment";
import type { ReinvestmentView } from "../domain/types";
import { listReinvestmentPercents } from "./reinvestment-repo";

const HISTORY_MONTHS = 24;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Tela de reinvestimento do usuário logado. `requested` vem da URL (?mes=); inválido ou futuro
 * cai no mês atual. O resultado é um DTO sem ids internos.
 */
export async function getReinvestmentView(requested: string | null): Promise<ReinvestmentView> {
  const tenant = await getTenant(); // chama connection(): só em tempo de requisição
  const nowMonth = currentMonthKey(new Date());
  const month = requested && MONTH.test(requested) && requested <= nowMonth ? requested : nowMonth;
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
    months: reinvestmentMonths(transactions, received, nowMonth),
    current: current!,
    purchases: purchases.map((item) => ({
      ...item,
      name: assets.get(item.ticker)?.name ?? null,
      logoUrl: assets.get(item.ticker)?.logoUrl ?? null,
    })),
    history,
    last12: summarizeReinvestment(history.slice(-12)),
  };
}
