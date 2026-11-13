import "server-only";
import { connectMongo } from "@/shared/db/mongo";
import type { AssetClass } from "../domain/asset-class";
import {
  crossesThreshold,
  sameMovement,
  withInsightDefaults,
  type DayInsight,
} from "../domain/day-insight";
import { marketIndexFor, marketReading } from "../domain/day-insight";
import { quoteSessionDate } from "../domain/market-hours";
import { AssetModel, MarketIndexModel } from "./models";

/**
 * O resumo da IA do movimento atual do ativo, ou null: sem resumo, de outro pregão, de uma chamada
 * que falhou (essa não aparece na tela), de um movimento de sinal trocado ou quando a variação
 * atual não passa mais do gatilho da classe. Só lê o que está guardado.
 */
export async function getDayInsight(
  ticker: string,
  assetClass: AssetClass | null,
): Promise<DayInsight | null> {
  await connectMongo();
  const doc = await AssetModel.findById(ticker, {
    quoteFetchedAt: 1,
    changePercent: 1,
    dayInsight: 1,
  }).lean();
  if (!doc?.dayInsight || !doc.quoteFetchedAt) return null;
  const change = doc.changePercent;
  if (typeof change !== "number" || !crossesThreshold(assetClass, change)) return null;
  const insight = withInsightDefaults(doc.dayInsight);
  const session = quoteSessionDate(doc.quoteFetchedAt);
  if (!sameMovement(insight, session, change)) return null;
  if (insight.status === "failed") return null;
  // A linha do mercado usa a variação atual do ativo e o índice do mesmo pregão; sem índice
  // do mesmo pregão, vale a guardada (com a variação guardada).
  const indexId = marketIndexFor(assetClass);
  const index = await MarketIndexModel.findById(indexId, { changePercent: 1, session: 1 }).lean();
  const currentIndex =
    index && index.session.getTime() === session.getTime() && Number.isFinite(index.changePercent)
      ? index.changePercent
      : null;
  const useCurrent = currentIndex !== null;
  return {
    session: insight.session,
    changePercent: useCurrent ? change : insight.changePercent,
    kind: insight.kind,
    status: insight.status,
    text: insight.text ?? null,
    sameDay: insight.sameDay,
    sources: (insight.sources ?? []).map(({ title, publisher, url, publishedAt }) => ({
      title,
      publisher,
      url,
      publishedAt,
    })),
    market: useCurrent
      ? { index: indexId, indexChange: currentIndex, reading: marketReading(change, currentIndex) }
      : insight.market
        ? {
            index: insight.market.index,
            indexChange: insight.market.indexChange,
            reading: insight.market.reading,
          }
        : null,
    model: insight.model ?? null,
    generatedAt: insight.generatedAt ?? null,
    attemptedAt: insight.attemptedAt,
  };
}
