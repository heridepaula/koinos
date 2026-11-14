import "server-only";
import mongoose from "mongoose";
import { classifyRisk } from "@/features/smart-buy";
import { connectMongo } from "@/shared/db/mongo";
import { thesisView } from "../domain/asset-thesis";
import { radarChips, radarSources, type RadarView } from "../domain/radar";
import { getAssetClasses } from "./catalog";
import { AssetModel } from "./models";

/** Chips e tese do Radar dos tickers (só os que têm algum dos dois). A tela só lê. */
export async function getRadarViews(
  tickers: readonly string[],
  now = new Date(),
): Promise<Map<string, RadarView>> {
  const views = new Map<string, RadarView>();
  if (tickers.length === 0) return views;
  await connectMongo();
  const unique = [...new Set(tickers)];
  const [docs, classes] = await Promise.all([
    AssetModel.find(
      { _id: mongoose.trusted({ $in: unique }) },
      {
        priceToBook: 1,
        fundamentalsFetchedAt: 1,
        vacancyPct: 1,
        fundType: 1,
        segment: 1,
        paperPct: 1,
        realEstatePct: 1,
        dy12m: 1,
        dividendsFetchedAt: 1,
        fundamentusIndicators: 1,
        radar: 1,
      },
    ).lean(),
    getAssetClasses(unique),
  ]);
  for (const doc of docs) {
    const assetClass = classes.get(doc._id) ?? null;
    const src = radarSources(doc, now);
    const chips =
      assetClass === "FII"
        ? radarChips({
            kind: "FII",
            macro: classifyRisk({
              fundType: doc.fundType ?? null,
              segment: doc.segment ?? null,
              paperPct: doc.paperPct ?? null,
              realEstatePct: doc.realEstatePct ?? null,
              category: null,
            }).macro,
            pvp: src.pvp,
            dy12m: src.dy12m,
            vacancy: src.vacancy,
            indicators: src.fiiIndicators,
          })
        : assetClass === "ACAO"
          ? radarChips({ kind: "ACAO", indicators: src.stockIndicators })
          : [];
    // A tese some depois de `staleDays` (`thesisView`): as evidências dela podem ter mudado.
    const thesis = thesisView(doc.radar ?? null, assetClass, now);
    if (chips.length > 0 || thesis) views.set(doc._id, { kind: assetClass, chips, thesis });
  }
  return views;
}
