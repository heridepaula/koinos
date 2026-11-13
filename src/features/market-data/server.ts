// API pública de servidor da feature market-data (dados públicos de mercado, sem dados de usuário).
import "server-only";

export { refreshQuotes, type RefreshResult } from "./server/quote-service";
export {
  countStaleQuotes,
  getAssetSnapshots,
  getMonthlyCloses,
  type AssetSnapshot,
  type FiiProfile,
} from "./server/assets-read";
export {
  ensureMonthlyCloses,
  ensureRecentCloses,
  refreshDividends,
  type HistoryRequest,
} from "./server/history-service";
export {
  getAssetClasses,
  getCatalogEntry,
  getCatalogSubType,
  refreshCatalog,
  searchTickers,
} from "./server/catalog";
export { refreshPayDates } from "./server/pay-dates-service";
export { getDayInsight } from "./server/day-insight-read";
export { refreshDayInsights, type DayInsightSummary } from "./server/day-insight-service";
export { refreshRadars, type RadarSummary } from "./server/radar-service";
export { refreshFundamentusIndicators, type IndicatorsSummary } from "./server/indicators-service";
export { reportApiUsage } from "./server/usage";
export { runDailyMarketJob, type DailyJobSummary } from "./server/daily-job";
export {
  refreshFundamentals,
  refreshMissingFundamentals,
  type FundamentalsSummary,
} from "./server/fundamentals-service";
export { readCatalogTypes } from "./server/catalog-db";
export { getRealRate } from "./server/treasury-read";
export { syncTreasuryRates, type TreasurySyncResult } from "./server/treasury-service";
export { getRadarViews } from "./server/radar-read";
export { collectNews, type NewsSummary } from "./server/news-service";
export { refreshMarketIndices, type IndicesSummary } from "./server/market-indices-service";
export { refreshWeekSummaries, type WeekSummaryRun } from "./server/week-summary-service";
export { getWeekSummary } from "./server/week-summary-read";
export { getAssetPulse, type AssetPulse } from "./server/asset-pulse";
