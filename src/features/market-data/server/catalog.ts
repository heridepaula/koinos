import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { connectMongo } from "@/shared/db/mongo";
import { env } from "@/shared/env";
import { createBrapiClient } from "../adapters/brapi";
import type { CatalogEntry } from "../ports";
import { CATALOG_ID, readCatalogFromDb } from "./catalog-db";
import { withLock } from "./lock";
import { TickerCatalogModel } from "./models";
import { recordBrapiRequest } from "./usage";

const CATALOG_TAG = "ticker-catalog";

// Catálogo público de tickers: pode ficar em cache compartilhado (não é dado de usuário).
async function loadCatalog(): Promise<CatalogEntry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  return readCatalogFromDb();
}

/** Baixa o catálogo da brapi (fundos e ações: 2 a 3 requisições) e grava no Mongo. */
export async function refreshCatalog(): Promise<number> {
  const brapi = createBrapiClient({
    token: env.BRAPI_TOKEN,
    onRequest: () => recordBrapiRequest(),
  });
  const entries = await brapi.fetchCatalog();
  if (entries.length === 0) return 0;
  await connectMongo();
  await TickerCatalogModel.updateOne(
    { _id: CATALOG_ID },
    { $set: { entries, fetchedAt: new Date() } },
    { upsert: true },
  );
  revalidateTag(CATALOG_TAG, { expire: 0 });
  return entries.length;
}

async function catalogEntries(): Promise<CatalogEntry[]> {
  const cached = await loadCatalog();
  if (cached.length > 0) return cached;
  // Catálogo ainda vazio (antes do primeiro cron): preenche uma vez, com trava contra corrida.
  await withLock("catalog", 120_000, refreshCatalog);
  return readCatalogFromDb();
}

/** Busca por prefixo do ticker primeiro; depois, ticker ou nome contendo o termo. */
export async function searchTickers(query: string, limit = 12): Promise<CatalogEntry[]> {
  const term = query.trim().toUpperCase();
  if (term.length < 2) return [];
  const entries = await catalogEntries();
  const byPrefix = entries.filter((entry) => entry.ticker.startsWith(term));
  const byContent = entries.filter(
    (entry) =>
      !entry.ticker.startsWith(term) &&
      (entry.ticker.includes(term) || entry.name.toUpperCase().includes(term)),
  );
  return [...byPrefix, ...byContent].slice(0, limit);
}

/** Subtipo da brapi (fii, fi-agro, etf, stock...) para sugerir a categoria do ativo. */
export async function getCatalogSubType(ticker: string): Promise<string | null> {
  const entries = await loadCatalog();
  return entries.find((entry) => entry.ticker === ticker)?.subType ?? null;
}
