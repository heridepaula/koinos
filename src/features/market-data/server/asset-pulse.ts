import "server-only";
import { connectMongo } from "@/shared/db/mongo";
import type { AssetClass } from "../domain/asset-class";
import { assetHeat, type AssetPulse } from "../domain/asset-heat";
import { quoteSessionDate } from "../domain/market-hours";
import { closesWithQuote } from "../domain/week-move";
import { WEEK_SUMMARY, weekSummaryVisible } from "../domain/week-summary";
import { AssetModel } from "./models";
import { storedIndexCloses, weekMoveOfDoc } from "./week-reading";

export type { AssetPulse };

/**
 * O pulso do ativo agora, só com o que está guardado (fechamentos, cotação, índices e o sentido da
 * leitura da semana visível da versão atual): nada é buscado. Null sem cotação.
 */
export async function getAssetPulse(
  ticker: string,
  assetClass: AssetClass | null,
  now: Date = new Date(),
): Promise<AssetPulse | null> {
  await connectMongo();
  const [doc, indexCloses] = await Promise.all([
    AssetModel.findById(ticker, {
      price: 1,
      quoteFetchedAt: 1,
      recentCloses: 1,
      weekSummary: 1,
    }).lean(),
    storedIndexCloses(),
  ]);
  if (!doc || typeof doc.price !== "number" || !doc.quoteFetchedAt) return null;
  const move = weekMoveOfDoc(doc, assetClass, indexCloses);
  const summary = doc.weekSummary;
  const tone =
    summary &&
    summary.status === "ok" &&
    summary.version === WEEK_SUMMARY.version &&
    weekSummaryVisible(summary, now)
      ? (summary.tone ?? null)
      : null;
  const heat = assetHeat({
    ticker,
    series: closesWithQuote(doc.recentCloses ?? [], {
      price: doc.price,
      session: quoteSessionDate(doc.quoteFetchedAt),
    }),
    assetClass,
    move,
    tone,
  });
  return { move, heat };
}
