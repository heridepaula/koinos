import "server-only";
import mongoose from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { mapWithConcurrency } from "@/shared/lib/concurrency";
import { addMonths, currentMonthKey, monthRange, todayTradeDate } from "@/shared/lib/time";
import { fetchFundamentusDividendsPage } from "../adapters/fundamentus";
import { yahooProvider } from "../adapters/yahoo";
import { mergeDividendHistory } from "../domain/dividend-merge";
import { dividendWindow, nextLastDividend, toDividendEntries } from "../domain/dividend-window";
import { parseFundamentusDividends, type PaySchedule } from "../domain/fundamentus";
import { AssetModel, PriceHistoryModel } from "./models";

const HISTORY_RECHECK_MS = 12 * 60 * 60 * 1000;
/** Fechamentos diários guardados: três semanas cobrem a sexta anterior mesmo com feriados. */
/** Um mês de fechamentos diários: a semana do card de variação e o 1M do gráfico do ativo. */
const RECENT_CLOSES_DAYS = 31;
const DIVIDENDS_RECHECK_MS = 20 * 60 * 60 * 1000;
/** Janela dos anúncios de proventos guardados no ativo. */
const ANNOUNCEMENT_WINDOW_MS = 400 * 86_400_000;
/**
 * Histórico de proventos buscado no Yahoo: 760 dias cabem na janela de 12 meses de calendário
 * de um FII parado há até 12 meses (o último provento fica a até 365 dias de hoje).
 */
const DIVIDENDS_LOOKBACK_DAYS = 760;
/**
 * Ativos processados ao mesmo tempo em cada etapa. O limite de requisições fica na fila do Yahoo
 * (e no semáforo do Fundamentus); aqui só sobra folga para a fila não ficar ociosa enquanto um
 * ativo lê a resposta ou grava no banco.
 */
const STEP_WORKERS = 16;

/**
 * Os rendimentos do FII no Fundamentus, para completar o Yahoo. Só XXXX11 (a página de FII não
 * tem tabela para units). Qualquer falha devolve null: o histórico fica só com o Yahoo.
 */
async function fundamentusRendimentos(ticker: string): Promise<PaySchedule[] | null> {
  if (!/^[A-Z]{4}11$/.test(ticker)) return null;
  try {
    return parseFundamentusDividends(await fetchFundamentusDividendsPage(ticker, "fii"), "fii");
  } catch (error) {
    console.warn(`[proventos] Fundamentus ${ticker}:`, errorMessage(error));
    return null;
  }
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
const monthStart = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
};

export type HistoryRequest = { ticker: string; fromMonth: string };

/**
 * Garante os fechamentos mensais (meses já encerrados) desde `fromMonth`, buscando no Yahoo
 * só o que falta. Meses passados não mudam, então cada um é buscado uma vez.
 * As buscas rodam em paralelo, até o limite da fila do Yahoo.
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
    STEP_WORKERS,
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
 * Guarda no ativo os fechamentos diários das últimas três semanas (Yahoo), para o L/P da semana.
 * Pula o ativo buscado nas últimas 12 h; `force` ignora essa checagem (o cron, depois do pregão).
 */
export async function ensureRecentCloses(
  tickers: readonly string[],
  now = new Date(),
  options: { force?: boolean } = {},
): Promise<{ updated: number }> {
  const unique = [...new Set(tickers)];
  if (unique.length === 0) return { updated: 0 };
  await connectMongo();
  const assets = await AssetModel.find(
    { _id: mongoose.trusted({ $in: unique }) },
    { recentClosesFetchedAt: 1 },
  ).lean();
  const fetchedAt = new Map(assets.map((asset) => [asset._id, asset.recentClosesFetchedAt]));
  const due = unique.filter(
    (ticker) =>
      options.force || (fetchedAt.get(ticker)?.getTime() ?? 0) < now.getTime() - HISTORY_RECHECK_MS,
  );
  const from = new Date(now.getTime() - RECENT_CLOSES_DAYS * 86_400_000);
  const results = await mapWithConcurrency(due, STEP_WORKERS, async (ticker): Promise<number> => {
    try {
      const closes = await yahooProvider.getDailyCloses(ticker, from);
      await AssetModel.updateOne(
        { _id: ticker },
        { $set: { recentCloses: closes, recentClosesFetchedAt: now } },
        { upsert: true },
      );
      return 1;
    } catch (error) {
      console.warn(`[fechamentos diários] ${ticker}:`, errorMessage(error));
      return 0;
    }
  });
  return { updated: results.reduce((sum, count) => sum + count, 0) };
}

/**
 * Atualiza o DY e a soma dos últimos 12 meses de calendário (com o número de pagamentos), o
 * último rendimento e os anúncios dos últimos 400 dias de cada ativo (Yahoo; nos FIIs, completado
 * pelo Fundamentus com `mergeDividendHistory`), em paralelo até o limite de cada fonte. Uma busca
 * sem proventos não apaga o último rendimento guardado. Pula o ativo buscado nas últimas 20 h;
 * `force` ignora essa checagem (conferência manual).
 *
 * Busca tudo primeiro e grava de uma vez no fim. `pricesReady` (o cron passa a atualização das
 * cotações) faz a gravação esperar os preços novos, sem atrasar as buscas: o DY é calculado com o
 * preço lido do banco depois dela.
 */
export async function refreshDividends(
  tickers: readonly string[],
  now = new Date(),
  options: { force?: boolean; pricesReady?: Promise<unknown> } = {},
): Promise<{ updated: number }> {
  const unique = [...new Set(tickers)];
  if (unique.length === 0) return { updated: 0 };
  await connectMongo();
  const assets = await AssetModel.find(
    { _id: mongoose.trusted({ $in: unique }) },
    { lastDividend: 1, dividendsFetchedAt: 1 },
  ).lean();
  const byTicker = new Map(assets.map((asset) => [asset._id, asset]));
  const due = unique.filter(
    (ticker) =>
      options.force ||
      (byTicker.get(ticker)?.dividendsFetchedAt?.getTime() ?? 0) <
        now.getTime() - DIVIDENDS_RECHECK_MS,
  );

  const from = new Date(now.getTime() - DIVIDENDS_LOOKBACK_DAYS * 86_400_000);
  // As datas ex guardadas são datas de negócio: o corte dos 400 dias também.
  const announcementsFrom = todayTradeDate(new Date(now.getTime() - ANNOUNCEMENT_WINDOW_MS));
  const fetched = await mapWithConcurrency(due, STEP_WORKERS, async (ticker) => {
    try {
      // O Yahoo é a base; o Fundamentus completa os meses que faltam e corrige valor errado.
      const [yahoo, fundamentus] = await Promise.all([
        yahooProvider.getDividends(ticker, from),
        fundamentusRendimentos(ticker),
      ]);
      const dividends = mergeDividendHistory(
        toDividendEntries(yahoo),
        fundamentus,
        todayTradeDate(from),
      );
      return { ticker, dividends };
    } catch (error) {
      console.warn(`[proventos] ${ticker}:`, errorMessage(error));
      return null;
    }
  });
  const ok = fetched.filter((item) => item !== null);
  if (ok.length === 0) return { updated: 0 };

  // Uma falha nas cotações não impede gravar os proventos: o DY usa o último preço guardado.
  await options.pricesReady?.catch(() => undefined);
  const prices = await AssetModel.find(
    { _id: mongoose.trusted({ $in: ok.map((item) => item.ticker) }) },
    { price: 1 },
  ).lean();
  const priceOf = new Map(prices.map((asset) => [asset._id, asset.price ?? null]));
  await AssetModel.bulkWrite(
    ok.map(({ ticker, dividends }) => {
      const { total, trailingTotal, payments, last } = dividendWindow(dividends, now);
      const stored = byTicker.get(ticker);
      const price = priceOf.get(ticker) ?? null;
      const storedLast = stored?.lastDividend
        ? { amount: stored.lastDividend.amount, exDate: stored.lastDividend.exDate }
        : null;
      return {
        updateOne: {
          filter: { _id: ticker },
          update: {
            $set: {
              dy12m: price && price > 0 ? trailingTotal / price : null,
              dividends12m: total,
              dividendPayments12m: payments,
              lastDividend: nextLastDividend(last, storedLast),
              dividendAnnouncements: dividends
                .filter((dividend) => dividend.exDate >= announcementsFrom)
                .map((dividend) => ({ exDate: dividend.exDate, perShare: dividend.amount })),
              dividendsFetchedAt: now,
            },
          },
          upsert: true,
        },
      };
    }),
    { ordered: false },
  );
  return { updated: ok.length };
}
