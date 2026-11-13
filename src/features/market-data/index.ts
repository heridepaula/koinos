// API pública da feature market-data para o cliente (regras puras e tipos).
export {
  dayChangeLabel,
  isMarketOpen,
  isQuoteStale,
  isTradingWindow,
  lastCloseAtOrBefore,
  marketSession,
  QUOTE_MAX_AGE_MS,
  quoteSessionDate,
  type MarketSession,
} from "./domain/market-hours";
export { assetClassOf, type AssetClass, type CatalogType } from "./domain/asset-class";
export {
  DAY_INSIGHT,
  type DayInsight,
  type DayInsightStatus,
  type InsightCandidate,
  type NewsItem,
} from "./domain/day-insight";
export { RADAR, type RadarChip, type RadarFact, type RadarView } from "./domain/radar";
export type { CatalogEntry, Quote, QuoteSource } from "./ports";
export {
  BENCHMARK_TITLE,
  MEDIAN_WINDOW,
  midRate,
  summarizeRate,
  trackedTitlesKey,
  type RateSummary,
  type TrackedTitle,
  type TreasurySeriesPoint,
} from "./domain/treasury-rates";
