"use server";

import { refresh } from "next/cache";
import { ActionError, authActionClient } from "@/features/auth/server";
import {
  refreshDividends,
  refreshMissingFundamentals,
  refreshQuotes,
} from "@/features/market-data/server";
import { listTargetAssetsOf } from "@/features/strategy/server";
import { computePositions } from "@/features/transactions";
import { listTransactionsOf } from "@/features/transactions/server";
import { currentMonthKey } from "@/shared/lib/time";
import { isReportMonth, roundPercent } from "./domain/reinvestment";
import { reinvestmentPercentSchema } from "./schemas";
import { clearReinvestmentPercent, setReinvestmentPercent } from "./server/reinvestment-repo";

/**
 * Atualiza as cotações vencidas dos ativos do usuário (em carteira + Carteira Alvo).
 * Os tickers saem do servidor, nunca do cliente; só cotações vencidas gastam cota.
 */
export const refreshMyQuotesAction = authActionClient
  .metadata({ actionName: "refreshMyQuotes" })
  .action(async ({ ctx }) => {
    const [transactions, targets] = await Promise.all([
      listTransactionsOf(ctx.tenant),
      listTargetAssetsOf(ctx.tenant),
    ]);
    const held = computePositions(transactions)
      .filter((position) => position.quantity > 0)
      .map((position) => position.ticker);
    const result = await refreshQuotes([...held, ...targets.map((target) => target.ticker)]);
    // DY e último rendimento também sob demanda (antes só no cron): quem acabou de importar
    // já vê o DY. refreshDividends pula o que foi buscado nas últimas 20 h.
    const dividends = await refreshDividends(held);
    // VP/P/VP (usebolsai): o cron das 2h é o normal; aqui só entra o que estiver faltando.
    const fundamentals = await refreshMissingFundamentals(targets.map((target) => target.ticker));
    if (
      (result.status === "done" && result.updated > 0) ||
      dividends.updated > 0 ||
      fundamentals.updated > 0
    ) {
      refresh();
    }
    return result;
  });

/** Salva a % reinvestida de um mês; `null` volta o mês ao padrão (100%). */
export const setReinvestmentPercentAction = authActionClient
  .metadata({ actionName: "setReinvestmentPercent", traceInput: ["month"] })
  .inputSchema(reinvestmentPercentSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { month, percent } = parsedInput;
    // A mesma regra da tela (reinvestment-view): AAAA-MM, de 2000-01 até o mês atual.
    if (!isReportMonth(month, currentMonthKey(new Date()))) {
      throw new ActionError("Escolha um mês entre 2000 e o mês atual.");
    }
    if (percent === null) {
      await clearReinvestmentPercent(ctx.tenant.portfolioId, month);
    } else {
      await setReinvestmentPercent(ctx.tenant.portfolioId, month, roundPercent(percent));
    }
    refresh();
    return { ok: true as const };
  });
