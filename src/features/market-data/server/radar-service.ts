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
import {
  needsThesis,
  termName,
  THESIS,
  thesisEvidence,
  thesisKey,
  type ThesisEvidence,
  type ThesisTarget,
} from "../domain/asset-thesis";
import { prioritizeInsights, type InsightCandidate } from "../domain/day-insight";
import {
  businessKind,
  describeAsset,
  normalizeForDuplicate,
  promptTerms,
  radarFacts,
  radarSources,
  radarTerms,
  type FiiRadarInput,
  type RadarInput,
  type RadarSourceDoc,
} from "../domain/radar";
import { getAssetClasses } from "./catalog";
import { generateThesis } from "./asset-thesis";
import { GEMINI_BUDGET_MS, geminiModelsWithQuota } from "./gemini-chain";
import { AssetModel, PriceHistoryModel, type AssetDoc } from "./models";
import { getRealRate } from "./treasury-read";

// Radar de fundamentos (spec 2026-11-12-radar-fundamentos-design.md) com a tese do ativo (spec
// 2026-11-13-tese-do-ativo-design.md): em segundo plano, de madrugada; a tela só lê a tese guardada.
// Ao Gemini vão só a descrição do ativo, as evidências e os termos (`buildThesisPrompt`).

/** Um alvo da Carteira Alvo para a tese (rank, teto e viés; o de melhor rank entre as carteiras). */
export type RadarTarget = {
  ticker: string;
  rank: number | null;
  ceiling: number | null;
  bias: "COMPRAR" | "AGUARDAR" | null;
};

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
  /** Textos iguais ao de outro ativo que ganharam uma segunda chamada. */
  duplicatesRetried: number;
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
  duplicatesRetried: 0,
  quotaExhausted: false,
});

/** A entrada pura do Radar a partir do documento do ativo; null para classe desconhecida. */
export function radarInputOf(
  doc: RadarSourceDoc & Pick<AssetDoc, "fundType" | "segment" | "paperPct" | "realEstatePct">,
  assetClass: "FII" | "ACAO" | null,
  realRate: number | null,
  now: Date,
  yearAgoClose: number | null = null,
): RadarInput | null {
  const src = radarSources(doc, now);
  const price = doc.price ?? null;
  const yearChange =
    price !== null && yearAgoClose !== null && price > 0 && yearAgoClose > 0
      ? price / yearAgoClose - 1
      : null;
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
      yearChange,
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
      yearChange,
    };
  }
  return null;
}

export async function refreshRadars(
  candidates: readonly InsightCandidate[],
  options: {
    maxAssets: number;
    now?: Date;
    deadline?: number;
    targets?: readonly RadarTarget[];
  },
): Promise<RadarSummary> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return empty("off");
  const now = options.now ?? new Date();
  const deadline = options.deadline ?? Date.now() + 25_000;
  return withSpan("radar.generate", {}, async (span) => {
    const summary =
      (await withLock("radar", 120_000, () =>
        run(apiKey, candidates, options.targets ?? [], options.maxAssets, now, deadline),
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
      "koinos.radar.duplicates_retried": summary.duplicatesRetried,
      "koinos.radar.quota_exhausted": summary.quotaExhausted,
    });
    return summary;
  });
}

/** O mês (AAAA-MM, UTC) de 12 meses antes de `now`. */
const yearAgoMonth = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1)).toISOString().slice(0, 7);

async function run(
  apiKey: string,
  candidates: readonly InsightCandidate[],
  targets: readonly RadarTarget[],
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
  for (const { ticker, rank } of targets) {
    if (!byTicker.has(ticker)) byTicker.set(ticker, { ticker, quantity: null, rank });
  }
  const tickers = [...byTicker.keys()];
  summary.candidates = tickers.length;
  if (tickers.length === 0) return summary;
  await connectMongo();
  const month = yearAgoMonth(now);
  const [docs, classes, rate, history] = await Promise.all([
    AssetModel.find({ _id: mongoose.trusted({ $in: tickers }) }).lean(),
    getAssetClasses(tickers),
    getRealRate(now).catch(() => null),
    PriceHistoryModel.find(
      { _id: mongoose.trusted({ $in: tickers.map((t) => `${t}:${month}`) }) },
      { ticker: 1, close: 1 },
    ).lean(),
  ]);
  // A taxa vem em % (6,5 = 6,5% a.a. real); o domínio usa fração.
  const realRate = rate && !rate.stale ? rate.median / 100 : null;
  // O alvo de cada ticker, com quantos ativos da mesma classe têm rank.
  const rankCount = (assetClass: "FII" | "ACAO") =>
    targets.filter((t) => t.rank !== null && classes.get(t.ticker) === assetClass).length;
  const targetOf = new Map<string, ThesisTarget | null>(
    targets.map((t) => {
      const assetClass = classes.get(t.ticker) ?? null;
      const target: ThesisTarget | null = assetClass
        ? { rank: t.rank, ceiling: t.ceiling, bias: t.bias, rankCount: rankCount(assetClass) }
        : null;
      return [t.ticker, target] as const;
    }),
  );
  const assets = new Map(docs.map((doc) => [doc._id, doc]));
  const yearAgo = new Map(history.map((h) => [h.ticker, h.close]));
  const ordered = prioritizeInsights([...byTicker.values()], (t) => assets.get(t)?.price ?? null);

  // As entradas de todos primeiro: o DY relativo compara cada FII com os do mesmo macro.
  const inputs = new Map<string, RadarInput>();
  for (const { ticker } of ordered) {
    const doc = assets.get(ticker);
    const assetClass = classes.get(ticker) ?? null;
    if (!doc || !assetClass) continue;
    const input = radarInputOf(doc, assetClass, realRate, now, yearAgo.get(ticker) ?? null);
    if (input) inputs.set(ticker, input);
  }
  const fiis = [...inputs.entries()].filter(
    (entry): entry is [string, FiiRadarInput] => entry[1].kind === "FII",
  );
  for (const [ticker, input] of fiis) {
    input.peerDy = fiis
      .filter(
        ([other, peer]) => other !== ticker && peer.macro === input.macro && peer.dy12m !== null,
      )
      .map(([, peer]) => peer.dy12m as number);
  }

  // Textos atuais de cada ativo, para achar repetição.
  const texts = new Map<string, string>();
  for (const doc of docs) {
    if (doc.radar?.status === "ok" && doc.radar.text) {
      texts.set(doc._id, normalizeForDuplicate(doc.radar.text));
    }
  }
  const repeated = (ticker: string, text: string) => {
    const key = normalizeForDuplicate(text);
    return [...texts.entries()].some(([other, value]) => other !== ticker && value === key);
  };

  const due: {
    ticker: string;
    input: RadarInput;
    facts: ReturnType<typeof radarFacts>;
    evidence: ThesisEvidence[];
    key: string;
  }[] = [];
  for (const [ticker, input] of inputs) {
    const doc = assets.get(ticker);
    const facts = radarFacts(input);
    if (facts.length === 0) {
      // Sem fatos o texto antigo seria falso: apaga.
      if (doc?.radar) {
        await AssetModel.updateOne({ _id: ticker }, { $set: { radar: null } });
        summary.cleared += 1;
      }
      continue;
    }
    const evidence = thesisEvidence({
      kind: input.kind,
      target: targetOf.get(ticker) ?? null,
      price: doc?.price ?? null,
      input,
      facts,
      week: doc?.weekSummary ?? null,
      now,
    });
    const key = thesisKey(evidence);
    if (!needsThesis(doc?.radar ?? null, key, now)) continue;
    due.push({ ticker, input, facts, evidence, key });
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
    const recentTerms = assets.get(item.ticker)?.radar?.termHistory ?? [];
    const terms = promptTerms(item.facts, recentTerms).map(termName);
    const call = (avoid: string | null, label: string) =>
      generateThesis({
        apiKey,
        models,
        kind: item.input.kind,
        description: describeAsset(item.input),
        evidence: item.evidence,
        terms,
        key: item.key,
        termHistory: recentTerms,
        avoid,
        now,
        deadline,
        label,
      });
    let out = await call(null, `radar ${item.ticker}`);
    summary.geminiCalls += out.calls;
    summary.rejected += out.rejected;
    if (!out.stored && out.rejected === 0) {
      // Todos os modelos falharam: nada gravado, a próxima chamada tenta de novo.
      summary.failed += 1;
      continue;
    }
    if (
      out.text !== null &&
      repeated(item.ticker, out.text) &&
      Date.now() < deadline - GEMINI_BUDGET_MS
    ) {
      // Igual à de outro ativo: uma nova chamada, uma vez. Se repetir de novo, grava assim mesmo;
      // a primeira só fica se a nova chamada falhar ou for recusada.
      summary.duplicatesRetried += 1;
      const again = await call(out.text, `radar ${item.ticker} retry`);
      summary.geminiCalls += again.calls;
      if (again.stored) out = again;
    }
    let stored = out.stored;
    if (stored) {
      summary.generated += 1;
      texts.set(item.ticker, normalizeForDuplicate(stored.text ?? ""));
      stored = {
        ...stored,
        termHistory: [radarTerms(stored.text ?? "", item.input.kind), ...recentTerms].slice(0, 2),
      };
    } else {
      stored = {
        version: THESIS.version,
        factsKey: item.key,
        status: "failed",
        text: null,
        model: out.model,
        generatedAt: now,
        termHistory: recentTerms,
      };
    }
    await AssetModel.updateOne({ _id: item.ticker }, { $set: { radar: stored } });
  }
  return summary;
}
