import "server-only";
import { settleAll } from "@/shared/lib/concurrency";
import { recordError, withSpan } from "@/shared/lib/tracing";
import { refreshCatalog } from "./catalog";
import {
  ensureMonthlyCloses,
  ensureRecentCloses,
  refreshDividends,
  type HistoryRequest,
} from "./history-service";
import { refreshFundamentusIndicators } from "./indicators-service";
import { refreshPayDates } from "./pay-dates-service";
import { refreshQuotes, type RefreshResult } from "./quote-service";
import { syncTreasuryRates } from "./treasury-service";

export type DailyJobSummary = {
  tickers: number;
  quotes: RefreshResult;
  dividends: number;
  payDates: { updated: number; failed: number };
  indicators: { updated: number; failed: number };
  historyMonths: number;
  recentCloses: number;
  catalog: number;
  treasury: { status: "not-modified" | "updated" | "busy" | "error"; upserted: number };
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Rotina diária (cron, depois do fechamento): cotações de fechamento, proventos/DY, datas de
 * pagamento, fechamentos mensais e diários, catálogo de tickers e taxa do Tesouro. Devolve só
 * contagens. Cada etapa tem o seu span (`cron.*`), para o APM mostrar quanto tempo vai em cada uma.
 *
 * As etapas rodam em paralelo; o limite de requisições fica em cada fonte (fila do Yahoo,
 * semáforo do Fundamentus), não em cada etapa. Só duas esperam outra:
 * - os proventos buscam junto com as cotações, mas gravam depois delas (o DY usa o preço novo);
 * - o catálogo vem depois das cotações, porque o plano gratuito da brapi não aceita duas
 *   requisições ao mesmo tempo.
 */
export async function runDailyMarketJob(
  requests: readonly HistoryRequest[],
  now = new Date(),
  options: { indicatorTickers?: readonly string[] } = {},
): Promise<DailyJobSummary> {
  const tickers = [...new Set(requests.map((request) => request.ticker))];
  const quotesStep = withSpan(
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
  const dividendsStep = withSpan(
    "cron.refresh-dividends",
    { "koinos.tickers": tickers.length },
    async (span) => {
      const result = await refreshDividends(tickers, now, { pricesReady: quotesStep });
      span.setAttribute("koinos.dividends.updated", result.updated);
      return result;
    },
  );
  // Datas de pagamento (Fundamentus): uma falha por ativo fica no log e não para a rotina.
  const payDatesStep = withSpan(
    "cron.refresh-pay-dates",
    { "koinos.tickers": tickers.length },
    async (span) => {
      try {
        const result = await refreshPayDates(tickers, now);
        span.setAttributes({
          "koinos.pay_dates.updated": result.updated,
          "koinos.pay_dates.failed": result.failed,
        });
        return result;
      } catch (error) {
        recordError(span, error);
        console.warn("[pagamentos]", errorMessage(error));
        return { updated: 0, failed: tickers.length };
      }
    },
  );
  // Indicadores do Fundamentus para o Radar: só posições e Carteira Alvo. Falha não para a rotina.
  const indicatorTickers = options.indicatorTickers ?? [];
  const indicatorsStep = withSpan(
    "cron.refresh-indicators",
    { "koinos.tickers": indicatorTickers.length },
    async (span) => {
      try {
        const result = await refreshFundamentusIndicators(indicatorTickers, now);
        span.setAttributes({
          "koinos.indicators.updated": result.updated,
          "koinos.indicators.failed": result.failed,
        });
        return { updated: result.updated, failed: result.failed };
      } catch (error) {
        recordError(span, error);
        console.warn("[indicadores]", errorMessage(error));
        return { updated: 0, failed: indicatorTickers.length };
      }
    },
  );
  const historyStep = withSpan(
    "cron.ensure-monthly-closes",
    { "koinos.tickers": tickers.length },
    async (span) => {
      const result = await ensureMonthlyCloses(requests, now);
      span.setAttribute("koinos.history.months_fetched", result.fetched);
      return result;
    },
  );
  // Depois do pregão: o fechamento de hoje entra na lista do L/P da semana.
  const recentStep = withSpan(
    "cron.ensure-recent-closes",
    { "koinos.tickers": tickers.length },
    async (span) => {
      const result = await ensureRecentCloses(tickers, now, { force: true });
      span.setAttribute("koinos.history.recent_updated", result.updated);
      return result;
    },
  );
  // Falhar o catálogo não derruba a rotina: o erro fica no span e no log.
  const catalogStep = quotesStep
    .catch(() => undefined)
    .then(() =>
      withSpan("cron.refresh-catalog", {}, async (span) => {
        try {
          const entries = await refreshCatalog();
          span.setAttribute("koinos.catalog.entries", entries);
          return entries;
        } catch (error) {
          recordError(span, error);
          console.warn("[catálogo]", errorMessage(error));
          return 0;
        }
      }),
    );
  // Falhar a taxa do Tesouro não derruba a rotina: o erro fica no span e no log.
  const treasuryStep = withSpan("cron.treasury", {}, async (span) => {
    try {
      const result = await syncTreasuryRates(now);
      span.setAttributes({
        "koinos.treasury.status": result.status,
        "koinos.treasury.rows_upserted": result.upserted,
      });
      if (result.baseDateAgeDays !== null) {
        span.setAttribute("koinos.treasury.base_date_age_days", result.baseDateAgeDays);
      }
      return { status: result.status, upserted: result.upserted };
    } catch (error) {
      recordError(span, error);
      span.setAttribute("koinos.treasury.status", "error");
      console.warn("[tesouro]", errorMessage(error));
      return { status: "error" as const, upserted: 0 };
    }
  });

  const [quotes, dividends, payDates, history, recent, catalog, treasury, indicators] =
    await settleAll([
      quotesStep,
      dividendsStep,
      payDatesStep,
      historyStep,
      recentStep,
      catalogStep,
      treasuryStep,
      indicatorsStep,
    ] as const);

  return {
    tickers: tickers.length,
    quotes,
    dividends: dividends.updated,
    payDates,
    indicators,
    historyMonths: history.fetched,
    recentCloses: recent.updated,
    catalog,
    treasury,
  };
}
