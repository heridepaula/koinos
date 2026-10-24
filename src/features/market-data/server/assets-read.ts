import "server-only";
import mongoose from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { isQuoteStale } from "../domain/market-hours";
import type { QuoteSource } from "../ports";
import { AssetModel, PriceHistoryModel } from "./models";

export type AssetSnapshot = {
  ticker: string;
  name: string | null;
  logoUrl: string | null;
  subType: string | null;
  price: number | null;
  changePercent: number | null;
  quoteSource: QuoteSource | null;
  quoteFetchedAt: Date | null;
  dy12m: number | null;
  lastDividend: { amount: number; exDate: Date } | null;
  /** Anúncios dos últimos 90 dias (Yahoo). A data ex é uma data de negócio. */
  dividendAnnouncements: { exDate: Date; perShare: number }[];
  /** Fechamentos diários das últimas semanas, do mais antigo ao mais recente. */
  recentCloses: { date: Date; close: number }[];
};

export async function getAssetSnapshots(
  tickers: readonly string[],
): Promise<Map<string, AssetSnapshot>> {
  const unique = [...new Set(tickers)];
  if (unique.length === 0) return new Map();
  await connectMongo();
  const docs = await AssetModel.find({ _id: mongoose.trusted({ $in: unique }) }).lean();
  return new Map(
    docs.map((doc) => [
      doc._id,
      {
        ticker: doc._id,
        name: doc.name ?? null,
        logoUrl: doc.logoUrl ?? null,
        subType: doc.subType ?? null,
        price: doc.price ?? null,
        changePercent: doc.changePercent ?? null,
        quoteSource: doc.quoteSource ?? null,
        quoteFetchedAt: doc.quoteFetchedAt ?? null,
        dy12m: doc.dy12m ?? null,
        lastDividend: doc.lastDividend
          ? { amount: doc.lastDividend.amount, exDate: doc.lastDividend.exDate }
          : null,
        dividendAnnouncements: (doc.dividendAnnouncements ?? []).map((item) => ({
          exDate: item.exDate,
          perShare: item.perShare,
        })),
        recentCloses: (doc.recentCloses ?? []).map((item) => ({
          date: item.date,
          close: item.close,
        })),
      },
    ]),
  );
}

/** Quantos dos tickers estão com cotação vencida agora. */
export function countStaleQuotes(
  tickers: readonly string[],
  snapshots: ReadonlyMap<string, AssetSnapshot>,
  now: Date,
): number {
  return tickers.filter((ticker) => isQuoteStale(snapshots.get(ticker)?.quoteFetchedAt, now))
    .length;
}

/** Fechamentos mensais gravados, por ticker: Map<ticker, Map<YYYY-MM, close>>. */
export async function getMonthlyCloses(
  tickers: readonly string[],
): Promise<Map<string, Map<string, number>>> {
  const unique = [...new Set(tickers)];
  const result = new Map<string, Map<string, number>>(unique.map((ticker) => [ticker, new Map()]));
  if (unique.length === 0) return result;
  await connectMongo();
  const docs = await PriceHistoryModel.find(
    { ticker: mongoose.trusted({ $in: unique }) },
    { ticker: 1, month: 1, close: 1 },
  ).lean();
  for (const doc of docs) result.get(doc.ticker)?.set(doc.month, doc.close);
  return result;
}
