import "server-only";
import mongoose from "mongoose";
import { classifyRisk } from "@/features/smart-buy";
import { connectMongo } from "@/shared/db/mongo";
import type { FiiIndicators, StockIndicators } from "../domain/fundamentus-indicators";
import { RADAR, radarChips, type RadarView } from "../domain/radar";
import { getAssetClasses } from "./catalog";
import { AssetModel } from "./models";

const DAY_MS = 86_400_000;

/** Chips e texto do Radar dos tickers (só os que têm algum dos dois). A tela só lê. */
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
  const within = (date: Date | null | undefined, days: number) =>
    date != null && now.getTime() - date.getTime() <= days * DAY_MS;
  for (const doc of docs) {
    const assetClass = classes.get(doc._id) ?? null;
    const ind = doc.fundamentusIndicators;
    const indFresh = within(ind?.fetchedAt, RADAR.staleDays);
    const profileFresh = within(doc.fundamentalsFetchedAt, 60);
    const dividendsFresh = within(doc.dividendsFetchedAt, RADAR.staleDays);
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
            pvp: profileFresh ? (doc.priceToBook ?? null) : null,
            dy12m: dividendsFresh ? (doc.dy12m ?? null) : null,
            vacancy: profileFresh && doc.vacancyPct != null ? doc.vacancyPct / 100 : null,
            indicators: indFresh && ind?.kind === "FII" ? (ind as FiiIndicators) : null,
          })
        : assetClass === "ACAO"
          ? radarChips({
              kind: "ACAO",
              indicators: indFresh && ind?.kind === "ACAO" ? (ind as StockIndicators) : null,
            })
          : [];
    const text = doc.radar?.status === "ok" ? doc.radar.text : null;
    if (chips.length > 0 || text) views.set(doc._id, { chips, text: text ?? null });
  }
  return views;
}
