import "server-only";
import mongoose, { Schema, type Model } from "mongoose";
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
   * Anúncios dos últimos 90 dias (Yahoo): data ex e valor por cota. A data ex é data de negócio
   * (meia-noite UTC do dia em São Paulo), como as datas dos lançamentos, e não o horário do Yahoo.
   */
  dividendAnnouncements?: { exDate: Date; perShare: number }[];
  dividendsFetchedAt?: Date | null;
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
}

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
    historyCheckedAt: { type: Date, default: null },
    historyFromMonth: { type: String, default: null },
    bookValuePerShare: { type: Number, default: null },
    bookValueMonth: { type: String, default: null },
    priceToBook: { type: Number, default: null },
    fundamentalsFetchedAt: { type: Date, default: null },
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
