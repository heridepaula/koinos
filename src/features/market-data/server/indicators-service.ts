import "server-only";
import mongoose from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { fetchFundamentusDetailsPage } from "../adapters/fundamentus";
import { parseFiiDetails, parseStockDetails } from "../domain/fundamentus-indicators";
import { getAssetClasses } from "./catalog";
import { AssetModel } from "./models";

// Indicadores do Fundamentus para o Radar (spec radar-fundamentos): uma página por ativo, no
// máximo a cada 20 h. O semáforo do adapter limita a 2 requisições ao site, somando as etapas.

const MIN_INTERVAL_MS = 20 * 60 * 60 * 1000;
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function refreshFundamentusIndicators(
  tickers: readonly string[],
  now = new Date(),
): Promise<{ updated: number; failed: number; skipped: number }> {
  const unique = [...new Set(tickers)];
  const summary = { updated: 0, failed: 0, skipped: 0 };
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
    docs.map((doc) => [doc._id, doc.fundamentusIndicators?.fetchedAt ?? null]),
  );
  await Promise.all(
    unique.map(async (ticker) => {
      const assetClass = classes.get(ticker) ?? null;
      const last = fetchedAt.get(ticker) ?? null;
      if (!assetClass || (last && now.getTime() - last.getTime() < MIN_INTERVAL_MS)) {
        summary.skipped += 1;
        return;
      }
      try {
        const html = await fetchFundamentusDetailsPage(ticker);
        const indicators = assetClass === "FII" ? parseFiiDetails(html) : parseStockDetails(html);
        await AssetModel.updateOne(
          { _id: ticker },
          { $set: { fundamentusIndicators: { ...indicators, fetchedAt: now } } },
        );
        summary.updated += 1;
      } catch (error) {
        // Nada é gravado: os indicadores antigos ficam até a próxima rotina.
        console.warn(`[indicadores] ${ticker}:`, errorMessage(error));
        summary.failed += 1;
      }
    }),
  );
  return summary;
}
