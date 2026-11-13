import "server-only";
import { connectMongo } from "@/shared/db/mongo";
import type { AssetClass } from "../domain/asset-class";
import { weekSummaryView, type WeekSummaryView } from "../domain/week-summary";
import { AssetModel } from "./models";

/**
 * A leitura da semana guardada do ativo, com as lentes rotuladas, ou null: sem resumo, com
 * `failed` ou com a geração há mais de 48 h (um ativo que saiu da Carteira Alvo perde o card
 * quando o texto envelhece). Só lê o que está guardado; o movimento em 7 dias e o termômetro vêm
 * de `getAssetPulse`.
 */
export async function getWeekSummary(
  ticker: string,
  assetClass: AssetClass | null,
  now: Date = new Date(),
): Promise<WeekSummaryView | null> {
  await connectMongo();
  const doc = await AssetModel.findById(ticker, { weekSummary: 1 }).lean();
  return weekSummaryView(doc?.weekSummary ?? null, assetClass, now);
}
