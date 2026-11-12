"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { ActionError, authActionClient } from "@/features/auth/server";
import {
  refreshDayInsights,
  refreshDividends,
  refreshPayDates,
  refreshMissingFundamentals,
  refreshQuotes,
  reportApiUsage,
} from "@/features/market-data/server";
import { listTargetAssetsOf } from "@/features/strategy/server";
import { computePositions } from "@/features/transactions";
import { listTransactionsOf } from "@/features/transactions/server";
import { settleAll } from "@/shared/lib/concurrency";
import { currentMonthKey } from "@/shared/lib/time";
import { isReportMonth, roundPercent } from "./domain/reinvestment";
import { markAlertsReadSchema, reinvestmentPercentSchema } from "./schemas";
import { markAlertsRead } from "./server/alert-read-repo";
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
    const positions = computePositions(transactions).filter((position) => position.quantity > 0);
    const held = positions.map((position) => position.ticker);
    const quotes = refreshQuotes([...held, ...targets.map((target) => target.ticker)]);
    // Resumo da IA das variações fortes: depois da resposta (after), com as cotações novas, para
    // não segurar a tela. No máximo 2 ativos por vez; o cron de 30 min cuida do resto.
    after(async () => {
      try {
        await quotes;
        await refreshDayInsights(
          [
            ...positions.map((position) => ({
              ticker: position.ticker,
              quantity: position.quantity,
              rank: null,
            })),
            ...targets.map((target) => ({
              ticker: target.ticker,
              quantity: null,
              rank: target.rank,
            })),
          ],
          { maxAssets: 2 },
        );
      } catch (error) {
        console.warn("[resumo-ia]", error instanceof Error ? error.message : String(error));
      }
    });
    // Tudo em paralelo; o limite de requisições fica em cada fonte. Só o DY espera: os proventos
    // buscam junto com as cotações e gravam depois delas, com o preço novo.
    const [result, dividends, payDates, fundamentals] = await settleAll([
      quotes,
      // DY e último rendimento também sob demanda (antes só no cron): quem acabou de importar
      // já vê o DY. refreshDividends pula o que foi buscado nas últimas 20 h.
      refreshDividends(held, new Date(), { pricesReady: quotes }),
      // Datas de pagamento do "a receber" (Fundamentus): também pula o buscado nas últimas 20 h.
      refreshPayDates(held),
      // VP/P/VP (usebolsai, que traz o próprio preço): o cron das 2h é o normal; aqui só entra o
      // que estiver faltando.
      refreshMissingFundamentals(targets.map((target) => target.ticker)),
    ] as const);
    // Só quando algo pode ter gastado cota: brapi (cotações vencidas) ou usebolsai.
    if ((result.status === "done" && result.stale > 0) || fundamentals.requested > 0) {
      await reportApiUsage();
    }
    if (
      (result.status === "done" && result.updated > 0) ||
      dividends.updated > 0 ||
      payDates.updated > 0 ||
      fundamentals.updated > 0
    ) {
      refresh();
    }
    return result;
  });

/**
 * Marca alertas do sino como lidos. Guarda a impressão que a tela mostrou: se o alerta mudou
 * entre a tela e o clique, a nova impressão segue não lida.
 */
export const markAlertsReadAction = authActionClient
  .metadata({ actionName: "markAlertsRead" })
  .inputSchema(markAlertsReadSchema)
  .action(async ({ parsedInput, ctx }) => {
    await markAlertsRead(ctx.tenant.portfolioId, parsedInput.alerts, new Date());
    refresh();
    return { ok: true as const };
  });

/** Exclui alertas do sino: somem até mudarem (um ativo novo, um valor ou uma data nova). */
export const dismissAlertsAction = authActionClient
  .metadata({ actionName: "dismissAlerts" })
  .inputSchema(markAlertsReadSchema)
  .action(async ({ parsedInput, ctx }) => {
    await markAlertsRead(ctx.tenant.portfolioId, parsedInput.alerts, new Date(), true);
    refresh();
    return { ok: true as const };
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
