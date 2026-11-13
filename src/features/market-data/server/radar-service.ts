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
import {
  buildRadarPrompt,
  businessKind,
  describeAsset,
  factsKey,
  needsRadar,
  radarFacts,
  radarSources,
  validateRadarText,
  type RadarInput,
  type RadarSourceDoc,
} from "../domain/radar";
import { getAssetClasses } from "./catalog";
import { GEMINI_BUDGET_MS, generateWithChain, geminiModelsWithQuota } from "./gemini-chain";
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
  /** Ativos que ficaram para a próxima chamada por falta de tempo. */
  deferred: number;
  /** Ativos que perderam todos os fatos e tiveram o texto antigo apagado. */
  cleared: number;
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
  deferred: 0,
  cleared: 0,
  geminiCalls: 0,
  quotaExhausted: false,
});

/** A entrada pura do Radar a partir do documento do ativo; null para classe desconhecida. */
export function radarInputOf(
  doc: RadarSourceDoc & Pick<AssetDoc, "fundType" | "segment" | "paperPct" | "realEstatePct">,
  assetClass: "FII" | "ACAO" | null,
  realRate: number | null,
  now: Date,
): RadarInput | null {
  const src = radarSources(doc, now);
  if (assetClass === "FII") {
    const { macro } = classifyRisk({
      fundType: doc.fundType ?? null,
      segment: doc.segment ?? null,
      paperPct: doc.paperPct ?? null,
      realEstatePct: doc.realEstatePct ?? null,
      category: null,
    });
    return {
      kind: "FII",
      macro,
      segment: doc.segment ?? null,
      fundType: doc.fundType ?? null,
      pvp: src.pvp,
      dividendRatio: src.dividendsKnown
        ? dividendRatio(src.lastDividendAmount, src.dividends12m)
        : null,
      suspended: isDividendSuspended(
        {
          daysSinceLastDividend: src.daysSinceLastDividend,
          dividendPayments12m: doc.dividendPayments12m ?? null,
        },
        ENGINE_VERSIONS["3.1"],
      ),
      dy12m: src.dy12m,
      realRate,
      vacancy: src.vacancy,
      peerDy: [],
      dividendTrend: src.dividendTrend,
      monthChange: src.monthChange,
      yearChange: null,
    };
  }
  if (assetClass === "ACAO") {
    const stock = src.stockIndicators;
    return {
      kind: "ACAO",
      business: businessKind(stock?.sector ?? null, stock?.subsector ?? null),
      isBank: (stock?.subsector ?? "").trim().toLowerCase() === "bancos",
      indicators: stock,
      dy12m: src.dy12m,
      payments12m: src.payments12m,
      dividendsKnown: src.dividendsKnown,
      monthChange: src.monthChange,
      yearChange: null,
    };
  }
  return null;
}

export async function refreshRadars(
  candidates: readonly InsightCandidate[],
  options: { maxAssets: number; now?: Date; deadline?: number },
): Promise<RadarSummary> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return empty("off");
  const now = options.now ?? new Date();
  const deadline = options.deadline ?? Date.now() + 25_000;
  return withSpan("radar.generate", {}, async (span) => {
    const summary =
      (await withLock("radar", 120_000, () =>
        run(apiKey, candidates, options.maxAssets, now, deadline),
      )) ?? empty("busy");
    span.setAttributes({
      "koinos.radar.status": summary.status,
      "koinos.radar.candidates": summary.candidates,
      "koinos.radar.due": summary.due,
      "koinos.radar.generated": summary.generated,
      "koinos.radar.rejected": summary.rejected,
      "koinos.radar.failed": summary.failed,
      "koinos.radar.deferred": summary.deferred,
      "koinos.radar.cleared": summary.cleared,
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
  deadline: number,
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

  const due: {
    ticker: string;
    kind: "FII" | "ACAO";
    description: string;
    facts: ReturnType<typeof radarFacts>;
  }[] = [];
  for (const { ticker } of ordered) {
    const doc = assets.get(ticker);
    const assetClass = classes.get(ticker) ?? null;
    if (!doc || !assetClass) continue;
    const input = radarInputOf(doc, assetClass, realRate, now);
    if (!input) continue;
    const facts = radarFacts(input);
    if (facts.length === 0) {
      // Sem fatos o texto antigo seria falso: apaga.
      if (doc.radar) {
        await AssetModel.updateOne({ _id: ticker }, { $set: { radar: null } });
        summary.cleared += 1;
      }
      continue;
    }
    if (!needsRadar(doc.radar ?? null, factsKey(facts), now)) continue;
    due.push({ ticker, kind: input.kind, description: describeAsset(input), facts });
  }
  summary.due = due.length;
  if (due.length === 0) return summary;

  if (Date.now() > deadline - GEMINI_BUDGET_MS) {
    summary.deferred = due.length;
    return summary;
  }
  const models = await geminiModelsWithQuota(now);
  const batch = due.slice(0, maxAssets);
  for (const [index, item] of batch.entries()) {
    if (Date.now() > deadline - GEMINI_BUDGET_MS) {
      summary.deferred = batch.length - index;
      break;
    }
    if (models.length === 0) {
      summary.quotaExhausted = true;
      break;
    }
    const { result, calls } = await generateWithChain(
      apiKey,
      models,
      buildRadarPrompt({
        kind: item.kind,
        description: item.description,
        facts: item.facts,
        recentTerms: [],
      }),
      { temperature: 0.2, maxOutputTokens: 2048, timeoutMs: 8_000 },
      now,
      `radar ${item.ticker}`,
      deadline,
    );
    summary.geminiCalls += calls;
    if (!result) {
      // Todos os modelos falharam: nada gravado, a próxima chamada tenta de novo.
      summary.failed += 1;
      continue;
    }
    const text = validateRadarText(result.text, result.finishReason, item.kind);
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
