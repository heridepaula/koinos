import { refreshFundamentals } from "@/features/market-data/server";
import { listAllTargetTickers } from "@/features/strategy/server";
import { cronJob } from "../job";

export const maxDuration = 60;

/**
 * VP e P/VP dos FIIs da Carteira Alvo (usebolsai), todo dia às 2h de Brasília (cron-job.org).
 * Responde só contagens.
 */
export const GET = cronJob("fundamentals", async (span) => {
  const tickers = await listAllTargetTickers();
  const summary = await refreshFundamentals(tickers);
  span.setAttributes({
    "koinos.fundamentals.requested": summary.requested,
    "koinos.fundamentals.updated": summary.updated,
    "koinos.fundamentals.missing": summary.missing,
    "koinos.fundamentals.failed": summary.failed,
  });
  return summary;
});
