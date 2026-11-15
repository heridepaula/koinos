import { runDailyMarketJob } from "@/features/market-data/server";
import { listAllTargetTickers } from "@/features/strategy/server";
import { listTradedTickersWithFirstDate } from "@/features/transactions/server";
import { withSpan } from "@/shared/lib/tracing";
import { currentMonthKey, monthKeyOfTradeDate } from "@/shared/lib/time";
import { cronJob } from "../job";

export const maxDuration = 300;

/**
 * Atualização diária (cron-job.org, seg a sex, 19:00). Responde só contagens, nunca dados de
 * carteiras. Cada etapa tem o seu span (`cron.*`), embaixo do `cron.daily`.
 */
export const GET = cronJob("daily", async (span) => {
  const now = new Date();
  const [traded, targetTickers] = await withSpan("cron.load-tickers", {}, () =>
    Promise.all([listTradedTickersWithFirstDate(), listAllTargetTickers()]),
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
  );
  span.setAttributes({
    "koinos.tickers": summary.tickers,
    "koinos.quotes.status": summary.quotes.status,
    "koinos.dividends.updated": summary.dividends,
    "koinos.history.months_fetched": summary.historyMonths,
    "koinos.catalog.entries": summary.catalog,
    "koinos.treasury.status": summary.treasury.status,
  });
  return summary;
});
