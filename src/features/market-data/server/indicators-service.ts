import "server-only";
import mongoose from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { fetchFundamentusDetailsPage } from "../adapters/fundamentus";
import { parseFiiDetails, parseStockDetails } from "../domain/fundamentus-indicators";
import { getAssetClasses } from "./catalog";
import { AssetModel } from "./models";

// Indicadores do Fundamentus para o Radar (spec radar-fundamentos): uma página por ativo, no
// máximo a cada 20 h. Roda na rota do Radar em lotes (`maxPages`), não no job diário: o
// cron-job.org corta a requisição em 30 s. O semáforo do adapter limita a 2 requisições ao site.

const REQUEST_TIMEOUT_MS = 5_000;
const MIN_INTERVAL_MS = 20 * 60 * 60 * 1000;
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export type IndicatorsSummary = { updated: number; failed: number; pending: number };

/** Atualiza até `maxPages` ativos vencidos, os mais antigos (ou nunca buscados) primeiro. */
export async function refreshFundamentusIndicators(
  tickers: readonly string[],
  options: { maxPages: number; now?: Date; deadline?: number },
): Promise<IndicatorsSummary> {
  const now = options.now ?? new Date();
  const unique = [...new Set(tickers)];
  const summary: IndicatorsSummary = { updated: 0, failed: 0, pending: 0 };
  if (unique.length === 0) return summary;
  await connectMongo();
  const [docs, classes] = await Promise.all([
    AssetModel.find(
      { _id: mongoose.trusted({ $in: unique }) },
      { fundamentusIndicators: 1 },
    ).lean(),
    getAssetClasses(unique),
  ]);
  const fetchedAt = new Map(
    docs.map((doc) => [doc._id, doc.fundamentusIndicators?.fetchedAt?.getTime() ?? 0]),
  );
  const due = unique
    .filter((ticker) => classes.get(ticker) != null)
    .filter((ticker) => now.getTime() - (fetchedAt.get(ticker) ?? 0) >= MIN_INTERVAL_MS)
    .sort((a, b) => (fetchedAt.get(a) ?? 0) - (fetchedAt.get(b) ?? 0));
  const batch = due.slice(0, options.maxPages);
  summary.pending = due.length - batch.length;
  await Promise.all(
    batch.map(async (ticker) => {
      // Na fila do semáforo pode passar do prazo: o que não começou fica para a próxima chamada.
      if (options.deadline !== undefined && Date.now() >= options.deadline) {
        summary.pending += 1;
        return;
      }
      try {
        const html = await fetchFundamentusDetailsPage(ticker, REQUEST_TIMEOUT_MS);
        const indicators =
          classes.get(ticker) === "FII" ? parseFiiDetails(html) : parseStockDetails(html);
        await AssetModel.updateOne(
          { _id: ticker },
          { $set: { fundamentusIndicators: { ...indicators, fetchedAt: now } } },
        );
        summary.updated += 1;
      } catch (error) {
        // Nada é gravado: os indicadores antigos ficam até a próxima chamada.
        console.warn(`[indicadores] ${ticker}:`, errorMessage(error));
        summary.failed += 1;
      }
    }),
  );
  return summary;
}
