import { quoteSessionDate } from "./market-hours";

// Índices do mercado para comparar a variação de um ativo com a do mercado no mesmo pregão
// (spec 2026-11-13-noticias-e-cenario-design.md). Testado em 2026-11-13: o Yahoo traz `^BVSP`
// e `IFIX.SA` (este só com o preço atual e o fechamento anterior). Puro.

export const MARKET_INDICES = [
  { id: "IBOV", symbol: "^BVSP" },
  { id: "IFIX", symbol: "IFIX.SA" },
] as const;

export type MarketIndexId = (typeof MARKET_INDICES)[number]["id"];

export type IndexQuote = {
  price: number | null;
  previousClose: number | null;
  /** Fração (0,0077 = 0,77%). */
  changePercent: number | null;
  time: Date | null;
};

export type MarketIndexValue = {
  price: number;
  previousClose: number | null;
  changePercent: number;
  /** O pregão da cotação (meia-noite UTC do dia em São Paulo). */
  session: Date;
};

export function marketIndexFromQuote(quote: IndexQuote, now: Date): MarketIndexValue | null {
  if (quote.price === null || !(quote.price > 0)) return null;
  const change =
    quote.changePercent ??
    (quote.previousClose !== null && quote.previousClose > 0
      ? quote.price / quote.previousClose - 1
      : null);
  if (change === null || !Number.isFinite(change)) return null;
  return {
    price: quote.price,
    previousClose: quote.previousClose,
    changePercent: change,
    session: quoteSessionDate(quote.time ?? now),
  };
}
