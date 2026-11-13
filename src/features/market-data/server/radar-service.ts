import "server-only";
import mongoose from "mongoose";
import {
  classifyRisk,
  dividendRatio,
  ENGINE_VERSIONS,
  isDividendSuspended,
} from "@/features/smart-buy";
import { withLock } from "@/shared/db/lock";
import { connectMongo } from "@/shared/db/mongo";
import { env } from "@/shared/env";
import { withSpan } from "@/shared/lib/tracing";
import { prioritizeInsights, type InsightCandidate } from "../domain/day-insight";
import type { StockIndicators } from "../domain/fundamentus-indicators";
import {
  buildRadarPrompt,
  businessKind,
  factsKey,
  needsRadar,
  RADAR,
  radarFacts,
  validateRadarText,
  type RadarInput,
} from "../domain/radar";
import { getAssetClasses } from "./catalog";
import { generateWithChain, geminiModelsWithQuota } from "./gemini-chain";
import { AssetModel, type AssetDoc } from "./models";
import { getRealRate } from "./treasury-read";

// Radar de fundamentos (spec 2026-11-12-radar-fundamentos-design.md): em segundo plano, de
// madrugada; a tela de Recomendações só lê o texto guardado.

export type RadarSummary = {
  status: "off" | "busy" | "done";
  candidates: number;
  due: number;
  generated: number;
  rejected: number;
  failed: number;
  geminiCalls: number;
  quotaExhausted: boolean;
};

const empty = (status: RadarSummary["status"]): RadarSummary => ({
  status,
  candidates: 0,
  due: 0,
  generated: 0,
  rejected: 0,
  failed: 0,
  geminiCalls: 0,
  quotaExhausted: false,
});

const DAY_MS = 86_400_000;
const fresh = (date: Date | null | undefined, now: Date, days: number) =>
  date != null && now.getTime() - date.getTime() <= days * DAY_MS;

/** A entrada pura do Radar a partir do documento do ativo; null para classe desconhecida. */
export function radarInputOf(
  doc: Pick<
    AssetDoc,
    | "priceToBook"
    | "fundamentalsFetchedAt"
    | "vacancyPct"
    | "fundType"
    | "segment"
    | "paperPct"
    | "realEstatePct"
    | "dy12m"
    | "lastDividend"
    | "dividends12m"
    | "dividendPayments12m"
    | "dividendsFetchedAt"
    | "fundamentusIndicators"
  >,
  assetClass: "FII" | "ACAO" | null,
  realRate: number | null,
  now: Date,
): RadarInput | null {
  const indicators = fresh(doc.fundamentusIndicators?.fetchedAt, now, RADAR.staleDays)
    ? (doc.fundamentusIndicators ?? null)
    : null;
  const dividendsFresh = fresh(doc.dividendsFetchedAt, now, RADAR.staleDays);
  if (assetClass === "FII") {
    const { macro } = classifyRisk({
      fundType: doc.fundType ?? null,
      segment: doc.segment ?? null,
      paperPct: doc.paperPct ?? null,
      realEstatePct: doc.realEstatePct ?? null,
      category: null,
    });
    // P/VP e vacância com mais de 60 dias contam como ausentes, como nos tensores.
    const profileFresh = fresh(doc.fundamentalsFetchedAt, now, 60);
    const daysSinceLastDividend =
      dividendsFresh && doc.lastDividend
        ? Math.floor((now.getTime() - doc.lastDividend.exDate.getTime()) / DAY_MS)
        : null;
    return {
      kind: "FII",
      macro,
      pvp: profileFresh ? (doc.priceToBook ?? null) : null,
      dividendRatio: dividendsFresh
        ? dividendRatio(doc.lastDividend?.amount ?? null, doc.dividends12m ?? null)
        : null,
      suspended: isDividendSuspended(
        { daysSinceLastDividend, dividendPayments12m: doc.dividendPayments12m ?? null },
        ENGINE_VERSIONS["3.1"],
      ),
      dy12m: dividendsFresh ? (doc.dy12m ?? null) : null,
      realRate,
      vacancy: profileFresh && doc.vacancyPct != null ? doc.vacancyPct / 100 : null,
    };
  }
  if (assetClass === "ACAO") {
    const stock = indicators?.kind === "ACAO" ? (indicators as StockIndicators) : null;
    return {
      kind: "ACAO",
      business: businessKind(stock?.sector ?? null, stock?.subsector ?? null),
      isBank: (stock?.subsector ?? "").trim().toLowerCase() === "bancos",
      indicators: stock,
      dy12m: dividendsFresh ? (doc.dy12m ?? null) : null,
      payments12m: dividendsFresh ? (doc.dividendPayments12m ?? null) : null,
      dividendsKnown: dividendsFresh,
    };
  }
  return null;
}

export async function refreshRadars(
  candidates: readonly InsightCandidate[],
  options: { maxAssets: number; now?: Date },
): Promise<RadarSummary> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return empty("off");
  const now = options.now ?? new Date();
  return withSpan("radar.generate", {}, async (span) => {
    const summary =
      (await withLock("radar", 120_000, () => run(apiKey, candidates, options.maxAssets, now))) ??
      empty("busy");
    span.setAttributes({
      "koinos.radar.status": summary.status,
      "koinos.radar.candidates": summary.candidates,
      "koinos.radar.due": summary.due,
      "koinos.radar.generated": summary.generated,
      "koinos.radar.rejected": summary.rejected,
      "koinos.radar.failed": summary.failed,
      "koinos.radar.gemini_calls": summary.geminiCalls,
      "koinos.radar.quota_exhausted": summary.quotaExhausted,
    });
    return summary;
  });
}

async function run(
  apiKey: string,
  candidates: readonly InsightCandidate[],
  maxAssets: number,
  now: Date,
): Promise<RadarSummary> {
  const summary = empty("done");
  const byTicker = new Map<string, InsightCandidate>();
  for (const candidate of candidates) {
    const known = byTicker.get(candidate.ticker);
    byTicker.set(candidate.ticker, {
      ticker: candidate.ticker,
      quantity: (known?.quantity ?? 0) + (candidate.quantity ?? 0) || null,
      rank: known?.rank ?? candidate.rank,
    });
  }
  const tickers = [...byTicker.keys()];
  summary.candidates = tickers.length;
  if (tickers.length === 0) return summary;
  await connectMongo();
  const [docs, classes, rate] = await Promise.all([
    AssetModel.find({ _id: mongoose.trusted({ $in: tickers }) }).lean(),
    getAssetClasses(tickers),
    getRealRate(now).catch(() => null),
  ]);
  // A taxa vem em % (6,5 = 6,5% a.a. real); o domínio usa fração.
  const realRate = rate && !rate.stale ? rate.median / 100 : null;
  const assets = new Map(docs.map((doc) => [doc._id, doc]));
  const ordered = prioritizeInsights([...byTicker.values()], (t) => assets.get(t)?.price ?? null);

  const due: { ticker: string; kind: "FII" | "ACAO"; facts: ReturnType<typeof radarFacts> }[] = [];
  for (const { ticker } of ordered) {
    const doc = assets.get(ticker);
    const assetClass = classes.get(ticker) ?? null;
    if (!doc || !assetClass) continue;
    const input = radarInputOf(doc, assetClass, realRate, now);
    if (!input) continue;
    const facts = radarFacts(input);
    if (facts.length === 0) continue;
    if (!needsRadar(doc.radar ?? null, factsKey(facts), now)) continue;
    due.push({ ticker, kind: input.kind, facts });
  }
  summary.due = due.length;
  if (due.length === 0) return summary;

  const models = await geminiModelsWithQuota(now);
  for (const item of due.slice(0, maxAssets)) {
    if (models.length === 0) {
      summary.quotaExhausted = true;
      break;
    }
    const { result, calls } = await generateWithChain(
      apiKey,
      models,
      buildRadarPrompt(item.kind, item.facts),
      { temperature: 0.2, maxOutputTokens: 2048 },
      now,
      `radar ${item.ticker}`,
    );
    summary.geminiCalls += calls;
    if (!result) {
      // Todos os modelos falharam: nada gravado, a próxima chamada tenta de novo.
      summary.failed += 1;
      continue;
    }
    const text = validateRadarText(result.text, result.finishReason);
    if (text === null) summary.rejected += 1;
    else summary.generated += 1;
    await AssetModel.updateOne(
      { _id: item.ticker },
      {
        $set: {
          radar: {
            factsKey: factsKey(item.facts),
            status: text === null ? "failed" : "ok",
            text,
            model: result.model,
            generatedAt: now,
          },
        },
      },
    );
  }
  return summary;
}
