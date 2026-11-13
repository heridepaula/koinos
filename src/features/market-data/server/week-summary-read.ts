import "server-only";
import { connectMongo } from "@/shared/db/mongo";
import type { AssetClass } from "../domain/asset-class";
import { quoteSessionDate } from "../domain/market-hours";
import { weekSummaryVisible, type WeekSummaryView } from "../domain/week-summary";
import { currentMarketReading } from "./market-reading";
import { AssetModel } from "./models";

/**
 * O resumo da semana guardado do ativo, com a variação e a linha do mercado atuais, ou null: sem
 * resumo, com `failed` ou com a geração há mais de 48 h (um ativo que saiu da Carteira
 * Alvo perde o card quando o texto envelhece). Só lê o que está guardado.
 */
export async function getWeekSummary(
  ticker: string,
  assetClass: AssetClass | null,
  now: Date = new Date(),
): Promise<WeekSummaryView | null> {
  await connectMongo();
  const doc = await AssetModel.findById(ticker, {
    quoteFetchedAt: 1,
    changePercent: 1,
    weekSummary: 1,
  }).lean();
  const stored = doc?.weekSummary;
  if (!stored || stored.status === "failed" || !weekSummaryVisible(stored, now)) return null;
  const change =
    typeof doc.changePercent === "number" && Number.isFinite(doc.changePercent)
      ? doc.changePercent
      : null;
  const market =
    change !== null && doc.quoteFetchedAt
      ? await currentMarketReading(assetClass, quoteSessionDate(doc.quoteFetchedAt), change)
      : null;
  return {
    status: stored.status,
    text: stored.status === "ok" ? (stored.text ?? null) : null,
    sources: (stored.sources ?? []).map(({ title, publisher, url, publishedAt }) => ({
      title,
      publisher,
      url,
      publishedAt,
    })),
    updatedAt: stored.generatedAt ?? stored.attemptedAt,
    changePercent: change,
    market,
  };
}
