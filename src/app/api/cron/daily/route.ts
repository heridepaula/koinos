import { reportApiUsage, runDailyMarketJob } from "@/features/market-data/server";
import { listAllTargetTickers } from "@/features/strategy/server";
import { listHeldQuantities, listTradedTickersWithFirstDate } from "@/features/transactions/server";
import { withSpan } from "@/shared/lib/tracing";
import { currentMonthKey, monthKeyOfTradeDate } from "@/shared/lib/time";
import { isCronAuthorized } from "../authorize";

export const maxDuration = 300;

/** Chamado pela Vercel Cron (vercel.json). Responde só contagens, nunca dados de carteiras. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }
  const now = new Date();
  // O span da rotina inteira leva o resumo; as etapas (cron.*) ficam embaixo dele.
  return withSpan("cron.daily", {}, async (span) => {
    const [traded, targetTickers, held] = await withSpan("cron.load-tickers", {}, () =>
      Promise.all([listTradedTickersWithFirstDate(), listAllTargetTickers(), listHeldQuantities()]),
    );
    // Histórico mensal desde o primeiro negócio; ativo só na Carteira Alvo precisa só da cotação.
    const fromMonth = new Map(
      traded.map(({ ticker, firstDate }) => [ticker, monthKeyOfTradeDate(firstDate)]),
    );
    for (const ticker of targetTickers) {
      if (!fromMonth.has(ticker)) fromMonth.set(ticker, currentMonthKey(now));
    }
    const summary = await runDailyMarketJob(
      [...fromMonth].map(([ticker, month]) => ({ ticker, fromMonth: month })),
      now,
      { indicatorTickers: [...new Set([...held.map(({ ticker }) => ticker), ...targetTickers])] },
    );
    span.setAttributes({
      "koinos.tickers": summary.tickers,
      "koinos.quotes.status": summary.quotes.status,
      "koinos.dividends.updated": summary.dividends,
      "koinos.history.months_fetched": summary.historyMonths,
      "koinos.catalog.entries": summary.catalog,
      "koinos.treasury.status": summary.treasury.status,
      "koinos.indicators.updated": summary.indicators.updated,
    });
    await reportApiUsage(now);
    return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
  });
}
