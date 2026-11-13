import "server-only";
import mongoose, { Schema, type Model } from "mongoose";
import type { DayInsight } from "../domain/day-insight";
import type { PaySchedule } from "../domain/fundamentus";
import type { FiiIndicators, StockIndicators } from "../domain/fundamentus-indicators";
import type { CatalogEntry, QuoteSource } from "../ports";

// Dados de mercado são públicos e compartilhados: nenhuma destas coleções guarda dado de usuário.

export interface AssetDoc {
  _id: string; // ticker
  name?: string | null;
  logoUrl?: string | null;
  subType?: string | null;
  price?: number | null;
  changePercent?: number | null;
  quoteSource?: QuoteSource | null;
  quoteTime?: Date | null;
  quoteFetchedAt?: Date | null;
  dy12m?: number | null;
  lastDividend?: { amount: number; exDate: Date } | null;
  /**
   * Anúncios dos últimos 400 dias (Yahoo): data ex e valor por cota. A data ex é data de negócio
   * (meia-noite UTC do dia em São Paulo), como as datas dos lançamentos, e não o horário do Yahoo.
   */
  dividendAnnouncements?: { exDate: Date; perShare: number }[];
  dividendsFetchedAt?: Date | null;
  /**
   * Proventos anunciados com data de pagamento (Fundamentus), de ~2 meses atrás em diante, com o
   * valor bruto por cota. Null quando o site não conhece o ativo.
   */
  payDates?: PaySchedule[] | null;
  payDatesFetchedAt?: Date | null;
  historyCheckedAt?: Date | null;
  /** Início (YYYY-MM) da faixa de histórico já buscada. */
  historyFromMonth?: string | null;
  /** Fechamentos diários das últimas semanas (Yahoo), para o L/P da semana. */
  recentCloses?: { date: Date; close: number }[];
  recentClosesFetchedAt?: Date | null;
  /** VP por cota (usebolsai, informe mensal da CVM) e o mês do informe (AAAA-MM). */
  bookValuePerShare?: number | null;
  bookValueMonth?: string | null;
  /** Fechamento do pregão anterior ÷ VP, calculado às 2h. */
  priceToBook?: number | null;
  fundamentalsFetchedAt?: Date | null;
  /** Última tentativa na usebolsai, com ou sem dado: segura as novas tentativas ao abrir o app. */
  fundamentalsCheckedAt?: Date | null;
  /** Vacância (%), segmento, tipo e composição do ativo (usebolsai), para as travas de risco. */
  vacancyPct?: number | null;
  segment?: string | null;
  fundType?: string | null;
  paperPct?: number | null;
  realEstatePct?: number | null;
  /** Soma dos proventos por cota dos 12 meses de calendário que terminam no mês do último (Yahoo). */
  dividends12m?: number | null;
  /** Quantos proventos entraram nessa soma. Mede a regularidade: um FII mensal tem 12. */
  dividendPayments12m?: number | null;
  /** O resumo da IA da variação forte do pregão (um por pregão; o de outro pregão é ignorado). */
  dayInsight?: DayInsight | null;
  /** Indicadores da página `detalhes.php` do Fundamentus (Radar de fundamentos). */
  fundamentusIndicators?: ((StockIndicators | FiiIndicators) & { fetchedAt: Date }) | null;
  /** O texto do Radar de fundamentos, refeito quando os fatos mudam. */
  radar?: {
    factsKey: string;
    status: "ok" | "failed";
    text: string | null;
    model: string | null;
    generatedAt: Date;
    /** Os termos do glossário (sem os comuns) dos 2 últimos textos, o mais novo primeiro. */
    termHistory?: string[][];
  } | null;
}

const newsItemSchema = new Schema(
  { title: String, publisher: String, url: String, publishedAt: Date },
  { _id: false },
);

const dayInsightSchema = new Schema(
  {
    session: Date,
    changePercent: Number,
    status: { type: String, enum: ["ok", "no-news", "failed"] },
    text: { type: String, default: null },
    sameDay: Boolean,
    sources: { type: [newsItemSchema], default: [] },
    model: { type: String, default: null },
    generatedAt: { type: Date, default: null },
    attemptedAt: Date,
  },
  { _id: false },
);

const fundamentusIndicatorsSchema = new Schema(
  {
    kind: { type: String, enum: ["ACAO", "FII"] },
    sector: { type: String, default: null },
    subsector: { type: String, default: null },
    balanceDate: { type: Date, default: null },
    pl: { type: Number, default: null },
    pvp: { type: Number, default: null },
    netMargin: { type: Number, default: null },
    ebitMargin: { type: Number, default: null },
    roe: { type: Number, default: null },
    roic: { type: Number, default: null },
    netDebtToEquity: { type: Number, default: null },
    currentRatio: { type: Number, default: null },
    revenueGrowth5y: { type: Number, default: null },
    netIncome12m: { type: Number, default: null },
    ffoYield: { type: Number, default: null },
    capRate: { type: Number, default: null },
    propertyCount: { type: Number, default: null },
    quarterlyReport: { type: Date, default: null },
    fetchedAt: Date,
  },
  { _id: false },
);

const radarSchema = new Schema(
  {
    factsKey: String,
    status: { type: String, enum: ["ok", "failed"] },
    text: { type: String, default: null },
    model: { type: String, default: null },
    generatedAt: Date,
    termHistory: { type: [[String]], default: [] },
  },
  { _id: false },
);

const assetSchema = new Schema<AssetDoc>(
  {
    _id: { type: String, required: true },
    name: { type: String, default: null },
    logoUrl: { type: String, default: null },
    subType: { type: String, default: null },
    price: { type: Number, default: null },
    changePercent: { type: Number, default: null },
    quoteSource: { type: String, enum: ["brapi", "yahoo", null], default: null },
    quoteTime: { type: Date, default: null },
    quoteFetchedAt: { type: Date, default: null },
    dy12m: { type: Number, default: null },
    lastDividend: {
      type: new Schema({ amount: Number, exDate: Date }, { _id: false }),
      default: null,
    },
    recentCloses: {
      type: [new Schema({ date: Date, close: Number }, { _id: false })],
      default: undefined,
    },
    recentClosesFetchedAt: { type: Date, default: null },
    dividendAnnouncements: {
      type: [new Schema({ exDate: Date, perShare: Number }, { _id: false })],
      default: [],
    },
    dividendsFetchedAt: { type: Date, default: null },
    payDates: {
      type: [
        new Schema(
          { comDate: Date, payDate: Date, perShare: Number, kind: String },
          { _id: false },
        ),
      ],
      default: undefined,
    },
    payDatesFetchedAt: { type: Date, default: null },
    historyCheckedAt: { type: Date, default: null },
    historyFromMonth: { type: String, default: null },
    bookValuePerShare: { type: Number, default: null },
    bookValueMonth: { type: String, default: null },
    priceToBook: { type: Number, default: null },
    fundamentalsFetchedAt: { type: Date, default: null },
    fundamentalsCheckedAt: { type: Date, default: null },
    vacancyPct: { type: Number, default: null },
    segment: { type: String, default: null },
    fundType: { type: String, default: null },
    paperPct: { type: Number, default: null },
    realEstatePct: { type: Number, default: null },
    dividends12m: { type: Number, default: null },
    dividendPayments12m: { type: Number, default: null },
    dayInsight: { type: dayInsightSchema, default: null },
    fundamentusIndicators: { type: fundamentusIndicatorsSchema, default: null },
    radar: { type: radarSchema, default: null },
  },
  { timestamps: true, versionKey: false },
);

export const AssetModel: Model<AssetDoc> =
  (mongoose.models.Asset as Model<AssetDoc> | undefined) ??
  mongoose.model<AssetDoc>("Asset", assetSchema, "assets");

export interface PriceHistoryDoc {
  _id: string; // TICKER:YYYY-MM
  ticker: string;
  month: string;
  close: number;
}

const priceHistorySchema = new Schema<PriceHistoryDoc>(
  {
    _id: { type: String, required: true },
    ticker: { type: String, required: true },
    month: { type: String, required: true },
    close: { type: Number, required: true },
  },
  { versionKey: false },
);
priceHistorySchema.index({ ticker: 1, month: 1 });

export const PriceHistoryModel: Model<PriceHistoryDoc> =
  (mongoose.models.PriceHistory as Model<PriceHistoryDoc> | undefined) ??
  mongoose.model<PriceHistoryDoc>("PriceHistory", priceHistorySchema, "price_history");

export interface ApiUsageDoc {
  _id: string; // provider:YYYY-MM
  count: number;
}

const apiUsageSchema = new Schema<ApiUsageDoc>(
  { _id: { type: String, required: true }, count: { type: Number, required: true, default: 0 } },
  { versionKey: false },
);

export const ApiUsageModel: Model<ApiUsageDoc> =
  (mongoose.models.ApiUsage as Model<ApiUsageDoc> | undefined) ??
  mongoose.model<ApiUsageDoc>("ApiUsage", apiUsageSchema, "api_usage");

export interface TickerCatalogDoc {
  _id: string;
  entries: CatalogEntry[];
  fetchedAt: Date;
}

const catalogEntrySchema = new Schema<CatalogEntry>(
  {
    ticker: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, default: null },
    subType: { type: String, default: null },
    logoUrl: { type: String, default: null },
  },
  { _id: false },
);

const tickerCatalogSchema = new Schema<TickerCatalogDoc>(
  {
    _id: { type: String, required: true },
    entries: { type: [catalogEntrySchema], default: [] },
    fetchedAt: { type: Date, required: true },
  },
  { versionKey: false },
);

export const TickerCatalogModel: Model<TickerCatalogDoc> =
  (mongoose.models.TickerCatalog as Model<TickerCatalogDoc> | undefined) ??
  mongoose.model<TickerCatalogDoc>("TickerCatalog", tickerCatalogSchema, "ticker_catalog");

export interface TreasuryRateDoc {
  _id: string; // TIPO|AAAA-MM-DD (vencimento)|AAAA-MM-DD (data-base)
  kind: string;
  /** aaaa-mm-dd */
  maturity: string;
  /** Data de negócio: meia-noite UTC. */
  baseDate: Date;
  /** % ao ano, taxa real (IPCA +). */
  buyRate: number;
  sellRate: number;
  buyPrice: number;
  sellPrice: number;
}

const treasuryRateSchema = new Schema<TreasuryRateDoc>(
  {
    _id: { type: String, required: true },
    kind: { type: String, required: true },
    maturity: { type: String, required: true },
    baseDate: { type: Date, required: true },
    buyRate: { type: Number, required: true },
    sellRate: { type: Number, required: true },
    buyPrice: { type: Number, required: true },
    sellPrice: { type: Number, required: true },
  },
  { timestamps: true, versionKey: false },
);
treasuryRateSchema.index({ kind: 1, maturity: 1, baseDate: -1 });

export const TreasuryRateModel: Model<TreasuryRateDoc> =
  (mongoose.models.TreasuryRate as Model<TreasuryRateDoc> | undefined) ??
  mongoose.model<TreasuryRateDoc>("TreasuryRate", treasuryRateSchema, "treasury_rates");

/** O estado da sincronização com o Tesouro Transparente: um único documento. */
export interface TreasurySyncDoc {
  _id: string;
  /** `last_modified` do recurso CSV no catálogo, como veio. */
  lastModified?: string | null;
  /** ETag do CSV, com as aspas, para o GET condicional. */
  etag?: string | null;
  /** Maior data-base dos títulos acompanhados já gravada (aaaa-mm-dd). */
  lastBaseDate?: string | null;
  /** `trackedTitlesKey` da última gravação completa: se mudar, o histórico é regravado. */
  titlesKey?: string | null;
  checkedAt?: Date | null;
}

const treasurySyncSchema = new Schema<TreasurySyncDoc>(
  {
    _id: { type: String, required: true },
    lastModified: { type: String, default: null },
    etag: { type: String, default: null },
    lastBaseDate: { type: String, default: null },
    titlesKey: { type: String, default: null },
    checkedAt: { type: Date, default: null },
  },
  { versionKey: false },
);

export const TreasurySyncModel: Model<TreasurySyncDoc> =
  (mongoose.models.TreasurySync as Model<TreasurySyncDoc> | undefined) ??
  mongoose.model<TreasurySyncDoc>("TreasurySync", treasurySyncSchema, "treasury_sync");

export interface MarketIndexDoc {
  _id: string; // "IBOV" | "IFIX"
  price: number;
  previousClose: number | null;
  changePercent: number;
  session: Date;
  fetchedAt: Date;
}

const marketIndexSchema = new Schema<MarketIndexDoc>(
  {
    _id: { type: String, required: true },
    price: { type: Number, required: true },
    previousClose: { type: Number, default: null },
    changePercent: { type: Number, required: true },
    session: { type: Date, required: true },
    fetchedAt: { type: Date, required: true },
  },
  { versionKey: false },
);

export const MarketIndexModel: Model<MarketIndexDoc> =
  (mongoose.models.MarketIndex as Model<MarketIndexDoc> | undefined) ??
  mongoose.model<MarketIndexDoc>("MarketIndex", marketIndexSchema, "market_indices");
