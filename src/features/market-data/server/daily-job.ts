import "server-only";
import { recordError, withSpan } from "@/shared/lib/tracing";
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
 * Cada etapa tem o seu span (`cron.*`), para o APM mostrar quanto tempo vai em cada uma.
 */
export async function runDailyMarketJob(
  requests: readonly HistoryRequest[],
  now = new Date(),
): Promise<DailyJobSummary> {
  const tickers = [...new Set(requests.map((request) => request.ticker))];
  const quotes = await withSpan(
    "cron.refresh-quotes",
    { "koinos.tickers": tickers.length },
    async (span) => {
      const result = await refreshQuotes(tickers, { force: true, now });
      span.setAttribute("koinos.quotes.status", result.status);
      if (result.status === "done") {
        span.setAttributes({
          "koinos.quotes.stale": result.stale,
          "koinos.quotes.updated": result.updated,
          "koinos.quotes.failed": result.failed,
        });
      }
      return result;
    },
  );
  // O DY usa o preço recém-atualizado, por isso vem depois das cotações.
  const dividends = await withSpan(
    "cron.refresh-dividends",
    { "koinos.tickers": tickers.length },
    async (span) => {
      const result = await refreshDividends(tickers, now);
      span.setAttribute("koinos.dividends.updated", result.updated);
      return result;
    },
  );
  const history = await withSpan(
    "cron.ensure-monthly-closes",
    { "koinos.tickers": tickers.length },
    async (span) => {
      const result = await ensureMonthlyCloses(requests, now);
      span.setAttribute("koinos.history.months_fetched", result.fetched);
      return result;
    },
  );
  // Falhar o catálogo não derruba a rotina: o erro fica no span e no log.
  const catalog = await withSpan("cron.refresh-catalog", {}, async (span) => {
    try {
      const entries = await refreshCatalog();
      span.setAttribute("koinos.catalog.entries", entries);
      return entries;
    } catch (error) {
      recordError(span, error);
      console.warn("[catálogo]", errorMessage(error));
      return 0;
    }
  });
  return {
    tickers: tickers.length,
    quotes,
    dividends: dividends.updated,
    historyMonths: history.fetched,
    catalog,
  };
}
