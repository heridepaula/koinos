// Interfaces (portas) das fontes de dados de mercado. brapi e Yahoo são adaptadores.

export type QuoteSource = "brapi" | "yahoo";

export type Quote = {
  ticker: string;
  price: number;
  /** Variação do dia como fração (4,04% = 0,0404). */
  changePercent: number | null;
  name: string | null;
  logoUrl: string | null;
  subType: string | null;
  /** Horário de mercado da cotação, quando a fonte informa. */
  quoteTime: Date | null;
};

export type QuoteBatch = { quotes: Map<string, Quote>; failed: Map<string, string> };

export interface QuoteProvider {
  readonly name: QuoteSource;
  getQuotes(tickers: readonly string[]): Promise<QuoteBatch>;
}

export type MonthlyClose = { month: string; close: number };
/** Fechamento de um pregão; `date` é a data de negócio (meia-noite UTC do dia em São Paulo). */
export type DailyClose = { date: Date; close: number };
export type DividendEvent = { exDate: Date; amount: number };

export interface HistoryProvider {
  getMonthlyCloses(ticker: string, from: Date): Promise<MonthlyClose[]>;
  getDailyCloses(ticker: string, from: Date): Promise<DailyClose[]>;
  getDividends(ticker: string, from: Date): Promise<DividendEvent[]>;
}

export type CatalogEntry = {
  ticker: string;
  name: string;
  type: string | null;
  subType: string | null;
  logoUrl: string | null;
};
