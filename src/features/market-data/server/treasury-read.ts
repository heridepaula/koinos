import "server-only";
import { connectMongo } from "@/shared/db/mongo";
import { toIsoDate } from "@/shared/lib/time";
import {
  BENCHMARK_TITLE,
  MEDIAN_WINDOW,
  summarizeRate,
  type RateSummary,
  type TrackedTitle,
  type TreasurySeriesPoint,
} from "../domain/treasury-rates";
import { TreasuryRateModel } from "./models";

/** Os últimos `limit` pregões do título, em ordem crescente de data-base. */
export async function readTreasurySeries(
  title: TrackedTitle = BENCHMARK_TITLE,
  limit = MEDIAN_WINDOW,
): Promise<TreasurySeriesPoint[]> {
  await connectMongo();
  const docs = await TreasuryRateModel.find({ kind: title.kind, maturity: title.maturity })
    .sort({ baseDate: -1 })
    .limit(limit)
    .lean();
  return docs.reverse().map((doc) => ({
    baseDate: toIsoDate(doc.baseDate),
    buyRate: doc.buyRate,
    sellRate: doc.sellRate,
  }));
}

/**
 * A taxa real da NTN-B 2035: o último ponto, a mediana de 60 pregões e a diferença. Null sem dados.
 * Só o aviso de divergência do teto usa (`readNtnbRealRate`, em `portfolio/server/snapshot.ts`).
 * Quem chamar de uma renderização precisa chegar aqui depois de `getTenant` (ou de
 * `await connection()`), como toda leitura de banco.
 */
export async function getRealRate(now = new Date()): Promise<RateSummary | null> {
  return summarizeRate(await readTreasurySeries(BENCHMARK_TITLE, MEDIAN_WINDOW), now);
}
