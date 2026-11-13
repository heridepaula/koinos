import "server-only";
import type { AssetClass } from "../domain/asset-class";
import { marketIndexFor, marketReading, type MarketReading } from "../domain/day-insight";
import { MarketIndexModel } from "./models";

/**
 * A linha do mercado agora: a variação atual do ativo contra o índice da classe (IFIX ou Ibovespa)
 * guardado em `market_indices`, só quando o índice é do mesmo pregão. Null sem índice desse pregão.
 * Usada pela leitura do resumo do dia e pela do resumo da semana.
 */
export async function currentMarketReading(
  assetClass: AssetClass | null,
  session: Date,
  assetChange: number,
): Promise<MarketReading | null> {
  const index = marketIndexFor(assetClass);
  const doc = await MarketIndexModel.findById(index, { changePercent: 1, session: 1 }).lean();
  if (!doc || doc.session.getTime() !== session.getTime()) return null;
  if (!Number.isFinite(doc.changePercent)) return null;
  return {
    index,
    indexChange: doc.changePercent,
    reading: marketReading(assetChange, doc.changePercent),
  };
}
