import "server-only";
import { connectMongo } from "@/shared/db/mongo";
import type { CatalogEntry } from "../ports";
import { TickerCatalogModel } from "./models";

export const CATALOG_ID = "b3";

/** Catálogo como está no banco, sem cache (o cache fica em catalog.ts). */
export async function readCatalogFromDb(): Promise<CatalogEntry[]> {
  await connectMongo();
  const doc = await TickerCatalogModel.findById(CATALOG_ID).lean();
  return (doc?.entries ?? []).map((entry) => ({
    ticker: entry.ticker,
    name: entry.name,
    type: entry.type ?? null,
    subType: entry.subType ?? null,
    logoUrl: entry.logoUrl ?? null,
  }));
}

/** Tipo e subtipo de cada ticker do catálogo (fund/stock, fii/fi-agro/etf...). */
export async function readCatalogTypes(): Promise<
  Map<string, { type: string | null; subType: string | null }>
> {
  const entries = await readCatalogFromDb();
  return new Map(
    entries.map((entry) => [entry.ticker, { type: entry.type, subType: entry.subType }]),
  );
}
