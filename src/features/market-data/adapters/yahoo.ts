import "server-only";
import YahooFinance from "yahoo-finance2";
import type { ChartResultArray } from "yahoo-finance2/modules/chart";
import { monthKeyOfTradeDate } from "@/shared/lib/time";
import type { DividendEvent, HistoryProvider, MonthlyClose, Quote, QuoteProvider } from "../ports";

type YahooClient = InstanceType<typeof YahooFinance>;
const globalForYahoo = globalThis as typeof globalThis & { __koinosYahoo?: YahooClient };

function client(): YahooClient {
  return (globalForYahoo.__koinosYahoo ??= new YahooFinance({ suppressNotices: ["yahooSurvey"] }));
}

// Ativos da B3 no Yahoo levam o sufixo .SA.
const toSymbol = (ticker: string) => `${ticker}.SA`;
const fromSymbol = (symbol: string) => symbol.replace(/\.SA$/i, "");
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const yahooProvider: QuoteProvider & HistoryProvider = {
  name: "yahoo",

  async getQuotes(tickers) {
    const quotes = new Map<string, Quote>();
    const failed = new Map<string, string>();
    if (tickers.length === 0) return { quotes, failed };

    try {
      const results = await client().quote(
        tickers.map(toSymbol),
        { return: "array" },
        { validateResult: false },
      );
      for (const result of results) {
        if (typeof result.regularMarketPrice !== "number" || result.regularMarketPrice <= 0) {
          continue;
        }
        const ticker = fromSymbol(result.symbol);
        quotes.set(ticker, {
          ticker,
          price: result.regularMarketPrice,
          changePercent:
            typeof result.regularMarketChangePercent === "number"
              ? result.regularMarketChangePercent / 100
              : null,
          name: result.longName ?? result.shortName ?? null,
          logoUrl: null,
          subType: null,
          quoteTime: result.regularMarketTime ?? null,
        });
      }
    } catch (error) {
      for (const ticker of tickers) failed.set(ticker, errorMessage(error));
      return { quotes, failed };
    }

    for (const ticker of tickers) {
      if (!quotes.has(ticker)) failed.set(ticker, "sem cotação no Yahoo");
    }
    return { quotes, failed };
  },

  async getMonthlyCloses(ticker, from): Promise<MonthlyClose[]> {
    // validateResult: false evita falhas por campos inesperados; o formato é o ChartResultArray.
    const result = (await client().chart(
      toSymbol(ticker),
      { period1: from, interval: "1mo" },
      { validateResult: false },
    )) as ChartResultArray;
    return result.quotes
      .filter((bar) => typeof bar.close === "number" && bar.close > 0)
      .map((bar) => ({ month: monthKeyOfTradeDate(bar.date), close: bar.close as number }));
  },

  async getDividends(ticker, from): Promise<DividendEvent[]> {
    const result = (await client().chart(
      toSymbol(ticker),
      { period1: from, interval: "1mo", events: "div" },
      { validateResult: false },
    )) as ChartResultArray;
    return (result.events?.dividends ?? [])
      .filter((dividend) => typeof dividend.amount === "number" && dividend.amount > 0)
      .map((dividend) => ({ exDate: dividend.date, amount: dividend.amount }));
  },
};
