import "server-only";
import { refreshCatalog } from "./catalog";
import { ensureMonthlyCloses, refreshDividends, type HistoryRequest } from "./history-service";
import { refreshQuotes, type RefreshResult } from "./quote-service";

export type DailyJobSummary = {
  tickers: number;
  quotes: RefreshResult;
  dividends: number;
  historyMonths: number;
  catalog: number;
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Rotina diária (cron, depois do fechamento): cotações de fechamento, proventos/DY,
 * fechamentos mensais que faltam e catálogo de tickers. Devolve só contagens.
 */
export async function runDailyMarketJob(
  requests: readonly HistoryRequest[],
  now = new Date(),
): Promise<DailyJobSummary> {
  const tickers = [...new Set(requests.map((request) => request.ticker))];
  const quotes = await refreshQuotes(tickers, { force: true, now });
  // O DY usa o preço recém-atualizado, por isso vem depois das cotações.
  const dividends = await refreshDividends(tickers, now);
  const history = await ensureMonthlyCloses(requests, now);
  const catalog = await refreshCatalog().catch((error: unknown) => {
    console.warn("[catálogo]", errorMessage(error));
    return 0;
  });
  return {
    tickers: tickers.length,
    quotes,
    dividends: dividends.updated,
    historyMonths: history.fetched,
    catalog,
  };
}
