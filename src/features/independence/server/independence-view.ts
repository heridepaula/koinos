import "server-only";
import { cache } from "react";
import { getTenant } from "@/features/auth/server";
import { reinvestmentHistory } from "@/features/portfolio";
import { getMyReinvestmentPercents, getPortfolioSnapshot } from "@/features/portfolio/server";
import { getMyDividends, getMyTransactions } from "@/features/transactions/server";
import { currentMonthKey } from "@/shared/lib/time";
import { traced } from "@/shared/lib/tracing";
import { averageMonthlyAporte, cashSales, closedMonths } from "../domain/aporte";
import { independenceSummary } from "../domain/plan";
import type { IndependenceView } from "../domain/types";
import { findIndependencePlan } from "./plan-repo";

/**
 * A meta de independência do usuário logado: o plano (ou o rascunho de um plano da v1), o
 * patrimônio do snapshot Geral e o aporte médio do bolso. DTO sem ids internos.
 */
export const getIndependenceView = cache(
  traced(
    "view.independence",
    async (): Promise<IndependenceView> => {
      const tenant = await getTenant(); // chama connection(): só em tempo de requisição
      const currentMonth = currentMonthKey(new Date());
      const months = closedMonths(currentMonth);
      const [{ plan, draft }, snapshot, transactions, received, percents] = await Promise.all([
        findIndependencePlan(tenant.portfolioId),
        getPortfolioSnapshot("TODOS"),
        getMyTransactions(),
        getMyDividends(),
        getMyReinvestmentPercents(),
      ]);
      const history = reinvestmentHistory({ transactions, received, percents, months });
      const monthlyAporte = averageMonthlyAporte(
        history.map((month) => ({
          fromPocket: month.fromPocket,
          sales: cashSales(transactions, month.month),
        })),
      );
      const koinosWealth = snapshot.summary.patrimony;
      return {
        plan,
        draft,
        summary: plan
          ? independenceSummary({ plan, koinosWealth, monthlyAporte, currentMonth })
          : null,
        koinosWealth,
        monthlyAporte,
        currentMonth,
      };
    },
    (view) => ({
      "koinos.independence.has_plan": view.plan !== null,
      "koinos.independence.has_draft": view.draft !== null,
    }),
  ),
);
