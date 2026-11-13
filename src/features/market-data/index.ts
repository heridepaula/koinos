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
  marketReadingText,
  type DayInsight,
  type DayInsightKind,
  type DayInsightStatus,
  type MarketReading,
  type InsightCandidate,
  type NewsItem,
} from "./domain/day-insight";
export type {
  NewsTone,
  WeekLensView,
  WeekSource,
  WeekSummaryView,
  WeekTone,
} from "./domain/week-summary";
export { weekMoveText, type WeekMove } from "./domain/week-move";
export {
  HEAT_LABELS,
  type AssetHeat,
  type AssetPulse,
  type HeatFactor,
  type HeatLevel,
} from "./domain/asset-heat";
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
