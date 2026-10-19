import "server-only";
import mongoose from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { ioConcurrency, mapWithConcurrency } from "@/shared/lib/concurrency";
import { addMonths, currentMonthKey, monthRange, todayTradeDate } from "@/shared/lib/time";
import { yahooProvider } from "../adapters/yahoo";
import { AssetModel, PriceHistoryModel } from "./models";

const HISTORY_RECHECK_MS = 12 * 60 * 60 * 1000;
const DIVIDENDS_RECHECK_MS = 20 * 60 * 60 * 1000;
/** Janela dos anúncios de proventos guardados no ativo. */
const ANNOUNCEMENT_WINDOW_MS = 90 * 86_400_000;
const YAHOO_CONCURRENCY_CAP = 6;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
const monthStart = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
};

export type HistoryRequest = { ticker: string; fromMonth: string };

/**
 * Garante os fechamentos mensais (meses já encerrados) desde `fromMonth`, buscando no Yahoo
 * só o que falta. Meses passados não mudam, então cada um é buscado uma vez.
 * As buscas rodam em paralelo, com limite pelos núcleos disponíveis.
 */
export async function ensureMonthlyCloses(
  requests: readonly HistoryRequest[],
  now = new Date(),
): Promise<{ fetched: number }> {
  if (requests.length === 0) return { fetched: 0 };
  await connectMongo();
  const lastCompleted = addMonths(currentMonthKey(now), -1);
  const tickers = requests.map((request) => request.ticker);

  const [existing, assets] = await Promise.all([
    PriceHistoryModel.find(
      { ticker: mongoose.trusted({ $in: tickers }) },
      { ticker: 1, month: 1 },
    ).lean(),
    AssetModel.find(
      { _id: mongoose.trusted({ $in: tickers }) },
      { historyCheckedAt: 1, historyFromMonth: 1 },
    ).lean(),
  ]);
  const have = new Map<string, Set<string>>();
  for (const doc of existing) {
    if (!have.has(doc.ticker)) have.set(doc.ticker, new Set());
    have.get(doc.ticker)!.add(doc.month);
  }
  const lastCheck = new Map(
    assets.map((asset) => [
      asset._id,
      { at: asset.historyCheckedAt ?? null, from: asset.historyFromMonth ?? null },
    ]),
  );

  const todo = requests.flatMap(({ ticker, fromMonth }) => {
    const months = fromMonth <= lastCompleted ? monthRange(fromMonth, lastCompleted) : [];
    const missing = months.filter((month) => !have.get(ticker)?.has(month));
    // Só pula se uma busca recente já cobriu esta mesma faixa: se o pedido começa mais cedo, busca de novo.
    const check = lastCheck.get(ticker);
    const coveredRecently =
      (check?.at?.getTime() ?? 0) > now.getTime() - HISTORY_RECHECK_MS &&
      check?.from !== null &&
      check?.from !== undefined &&
      check.from <= fromMonth;
    return missing.length > 0 && !coveredRecently
      ? [{ ticker, from: missing[0]!, requestedFrom: fromMonth }]
      : [];
  });

  const fetched = await mapWithConcurrency(
    todo,
    ioConcurrency(YAHOO_CONCURRENCY_CAP),
    async ({ ticker, from, requestedFrom }) => {
      try {
        const closes = await yahooProvider.getMonthlyCloses(ticker, monthStart(from));
        const completed = closes.filter((close) => close.month <= lastCompleted);
        if (completed.length > 0) {
          await PriceHistoryModel.bulkWrite(
            completed.map((close) => ({
              updateOne: {
                filter: { _id: `${ticker}:${close.month}` },
                update: { $set: { ticker, month: close.month, close: close.close } },
                upsert: true,
              },
            })),
          );
        }
        return completed.length;
      } catch (error) {
        console.warn(`[histórico] ${ticker}:`, errorMessage(error));
        return 0;
      } finally {
        // Mínimo calculado aqui (e não com $min): no BSON, null é menor que qualquer string.
        const previousFrom = lastCheck.get(ticker)?.from ?? null;
        const coveredFrom =
          previousFrom !== null && previousFrom <= requestedFrom ? previousFrom : requestedFrom;
        await AssetModel.updateOne(
          { _id: ticker },
          { $set: { historyCheckedAt: now, historyFromMonth: coveredFrom } },
          { upsert: true },
        );
      }
    },
  );
  return { fetched: fetched.reduce((sum, count) => sum + count, 0) };
}

/**
 * Atualiza o DY dos últimos 12 meses, o último rendimento e os anúncios dos últimos 90 dias
 * de cada ativo (Yahoo), em paralelo com limite pelos núcleos disponíveis.
 * Pula o ativo buscado nas últimas 20 h; `force` ignora essa checagem (conferência manual).
 */
export async function refreshDividends(
  tickers: readonly string[],
  now = new Date(),
  options: { force?: boolean } = {},
): Promise<{ updated: number }> {
  const unique = [...new Set(tickers)];
  if (unique.length === 0) return { updated: 0 };
  await connectMongo();
  const assets = await AssetModel.find(
    { _id: mongoose.trusted({ $in: unique }) },
    { price: 1, dividendsFetchedAt: 1 },
  ).lean();
  const byTicker = new Map(assets.map((asset) => [asset._id, asset]));
  const due = unique.filter(
    (ticker) =>
      options.force ||
      (byTicker.get(ticker)?.dividendsFetchedAt?.getTime() ?? 0) <
        now.getTime() - DIVIDENDS_RECHECK_MS,
  );

  const yearAgo = new Date(now.getTime() - 365 * 86_400_000);
  const from = new Date(now.getTime() - 400 * 86_400_000);
  const results = await mapWithConcurrency(
    due,
    ioConcurrency(YAHOO_CONCURRENCY_CAP),
    async (ticker): Promise<number> => {
      try {
        const dividends = await yahooProvider.getDividends(ticker, from);
        const last12m = dividends.filter((dividend) => dividend.exDate >= yearAgo);
        const total = last12m.reduce((sum, dividend) => sum + dividend.amount, 0);
        const price = byTicker.get(ticker)?.price ?? null;
        const latest = dividends.reduce<(typeof dividends)[number] | null>(
          (best, dividend) => (!best || dividend.exDate > best.exDate ? dividend : best),
          null,
        );
        await AssetModel.updateOne(
          { _id: ticker },
          {
            $set: {
              dy12m: price && price > 0 ? total / price : null,
              lastDividend: latest ? { amount: latest.amount, exDate: latest.exDate } : null,
              // O Yahoo manda a data ex às 13:00Z (10:00 em São Paulo): guarda só o dia, como
              // data de negócio (meia-noite UTC), o formato que as regras de proventos esperam.
              dividendAnnouncements: dividends
                .filter(
                  (dividend) => dividend.exDate.getTime() >= now.getTime() - ANNOUNCEMENT_WINDOW_MS,
                )
                .map((dividend) => ({
                  exDate: todayTradeDate(dividend.exDate),
                  perShare: dividend.amount,
                })),
              dividendsFetchedAt: now,
            },
          },
          { upsert: true },
        );
        return 1;
      } catch (error) {
        console.warn(`[proventos] ${ticker}:`, errorMessage(error));
        return 0;
      }
    },
  );
  return { updated: results.reduce((sum, count) => sum + count, 0) };
}
