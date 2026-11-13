import { isQuoteStale, isTradingWindow, quoteSessionDate } from "./market-hours";

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

/** O fechamento de um índice num pregão: a última leitura daquele pregão. */
export type IndexClose = { session: Date; close: number };

/**
 * Pregões guardados por índice: o Yahoo não tem histórico do `IFIX.SA`, então a variação da semana
 * (spec 2026-11-13-leitura-da-semana-design.md) vem de guardar a última leitura de cada pregão.
 */
export const INDEX_CLOSES_KEPT = 40;

/**
 * Os fechamentos com a leitura atual: ela vira (ou substitui) o fechamento do seu pregão, em ordem
 * de data, só os `INDEX_CLOSES_KEPT` mais recentes.
 */
export function nextIndexCloses(
  stored: readonly IndexClose[] | null | undefined,
  value: { session: Date; price: number },
): IndexClose[] {
  const others = (stored ?? []).filter(
    (item) => item.session.getTime() !== value.session.getTime(),
  );
  return [...others, { session: value.session, close: value.price }]
    .sort((a, b) => a.session.getTime() - b.session.getTime())
    .slice(-INDEX_CLOSES_KEPT);
}

/** O cron roda a cada 30 min; com 25 a chamada um pouco adiantada também atualiza. */
export const INDEX_REFRESH_MS = 25 * 60_000;

/**
 * Se o índice deve ser lido de novo. No pregão, a partir de 25 min da última leitura (o
 * `isQuoteStale` exige mais de 30 e uma chamada adiantada pularia uma rodada); fora dele, a regra
 * das cotações.
 */
export function isIndexStale(fetchedAt: Date | null | undefined, now: Date): boolean {
  if (!fetchedAt) return true;
  if (isTradingWindow(now)) return now.getTime() - fetchedAt.getTime() >= INDEX_REFRESH_MS;
  return isQuoteStale(fetchedAt, now);
}

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
