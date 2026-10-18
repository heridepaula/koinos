"use server";

import { refresh } from "next/cache";
import { authActionClient } from "@/features/auth/server";
import { refreshDividends, refreshQuotes } from "@/features/market-data/server";
import { listTargetAssetsOf } from "@/features/strategy/server";
import { computePositions } from "@/features/transactions";
import { listTransactionsOf } from "@/features/transactions/server";

/**
 * Atualiza as cotações vencidas dos ativos do usuário (em carteira + Carteira Alvo).
 * Os tickers saem do servidor, nunca do cliente; só cotações vencidas gastam cota.
 */
export const refreshMyQuotesAction = authActionClient.action(async ({ ctx }) => {
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
  if ((result.status === "done" && result.updated > 0) || dividends.updated > 0) refresh();
  return result;
});
