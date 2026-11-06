import "server-only";
import mongoose from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { mapWithConcurrency } from "@/shared/lib/concurrency";
import { todayTradeDate } from "@/shared/lib/time";
import { fetchFundamentusDividendsPage } from "../adapters/fundamentus";
import {
  parseFundamentusDividends,
  type FundamentusPage,
  type PaySchedule,
} from "../domain/fundamentus";
import { AssetModel } from "./models";

const RECHECK_MS = 20 * 60 * 60 * 1000;
/** Guarda o que paga desde ~2 meses atrás: cobre o mês atual inteiro, mesmo o que já passou. */
const KEEP_FROM_DAYS = 62;
/** Poucas requisições ao mesmo tempo: o site é de terceiros. */
const CONCURRENCY = 2;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** XXXX11 tenta a página de FII e, sem tabela (units como TAEE11), a de ações; o resto, só ações. */
const pagesOf = (ticker: string): FundamentusPage[] =>
  /^[A-Z]{4}11$/.test(ticker) ? ["fii", "acao"] : ["acao"];

async function fetchSchedules(ticker: string): Promise<PaySchedule[] | null> {
  for (const page of pagesOf(ticker)) {
    const schedules = parseFundamentusDividends(
      await fetchFundamentusDividendsPage(ticker, page),
      page,
    );
    if (schedules) return schedules;
  }
  return null;
}

/**
 * Guarda no ativo os proventos anunciados com data de pagamento (Fundamentus), para o "a
 * receber". Pula o ativo buscado nas últimas 20 h; `force` ignora essa checagem. Ticker que o
 * site não conhece guarda null (o "a receber" usa o Yahoo); uma busca que falha não grava nada.
 */
export async function refreshPayDates(
  tickers: readonly string[],
  now = new Date(),
  options: { force?: boolean } = {},
): Promise<{ updated: number; failed: number }> {
  const unique = [...new Set(tickers)];
  if (unique.length === 0) return { updated: 0, failed: 0 };
  await connectMongo();
  const assets = await AssetModel.find(
    { _id: mongoose.trusted({ $in: unique }) },
    { payDatesFetchedAt: 1 },
  ).lean();
  const fetchedAt = new Map(assets.map((asset) => [asset._id, asset.payDatesFetchedAt]));
  const due = unique.filter(
    (ticker) =>
      options.force || (fetchedAt.get(ticker)?.getTime() ?? 0) < now.getTime() - RECHECK_MS,
  );
  const keepFrom = todayTradeDate(new Date(now.getTime() - KEEP_FROM_DAYS * 86_400_000));
  const results = await mapWithConcurrency(due, CONCURRENCY, async (ticker) => {
    try {
      const schedules = await fetchSchedules(ticker);
      await AssetModel.updateOne(
        { _id: ticker },
        {
          $set: {
            payDates: schedules?.filter((item) => item.payDate >= keepFrom) ?? null,
            payDatesFetchedAt: now,
          },
        },
        { upsert: true },
      );
      return "updated" as const;
    } catch (error) {
      console.warn(`[pagamentos] ${ticker}:`, errorMessage(error));
      return "failed" as const;
    }
  });
  return {
    updated: results.filter((result) => result === "updated").length,
    failed: results.filter((result) => result === "failed").length,
  };
}
