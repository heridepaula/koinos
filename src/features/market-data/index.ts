// API pública da feature market-data para o cliente (regras puras e tipos).
export {
  isQuoteStale,
  isTradingWindow,
  lastCloseAtOrBefore,
  QUOTE_MAX_AGE_MS,
} from "./domain/market-hours";
export type { CatalogEntry, Quote, QuoteSource } from "./ports";
