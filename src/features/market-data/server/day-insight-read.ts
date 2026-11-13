import "server-only";
import { connectMongo } from "@/shared/db/mongo";
import { withInsightDefaults, type DayInsight } from "../domain/day-insight";
import { quoteSessionDate } from "../domain/market-hours";
import { AssetModel } from "./models";

/**
 * O resumo da IA do pregão da cotação atual do ativo, ou null: sem resumo, de outro pregão ou de
 * uma chamada que falhou (essa não aparece na tela). Só lê o que está guardado.
 */
export async function getDayInsight(ticker: string): Promise<DayInsight | null> {
  await connectMongo();
  const doc = await AssetModel.findById(ticker, { quoteFetchedAt: 1, dayInsight: 1 }).lean();
  const insight = doc?.dayInsight;
  if (!insight || !doc.quoteFetchedAt) return null;
  if (insight.session.getTime() !== quoteSessionDate(doc.quoteFetchedAt).getTime()) return null;
  if (insight.status === "failed") return null;
  return withInsightDefaults({
    session: insight.session,
    changePercent: insight.changePercent,
    status: insight.status,
    text: insight.text ?? null,
    sameDay: insight.sameDay,
    sources: (insight.sources ?? []).map(({ title, publisher, url, publishedAt }) => ({
      title,
      publisher,
      url,
      publishedAt,
    })),
    model: insight.model ?? null,
    generatedAt: insight.generatedAt ?? null,
    attemptedAt: insight.attemptedAt,
    kind: insight.kind,
    market: insight.market,
  });
}
