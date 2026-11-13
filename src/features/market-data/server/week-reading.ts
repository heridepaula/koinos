import "server-only";
import type { AssetClass } from "../domain/asset-class";
import { marketIndexFor, type GeminiModel, type NewsItem } from "../domain/day-insight";
import { quoteSessionDate } from "../domain/market-hours";
import type { IndexClose, MarketIndexId } from "../domain/market-indices";
import { describeAsset, RADAR, radarSources } from "../domain/radar";
import { weekMoveKey, weekMoveOf, type WeekMove } from "../domain/week-move";
import {
  buildWeekSummaryPrompt,
  parseWeekReading,
  WEEK_SUMMARY,
  weekReadingSchema,
  weekSummaryFromReading,
  type DividendTrendWord,
  type WeekPromptItem,
  type WeekSummary,
} from "../domain/week-summary";
import { generateWithChain } from "./gemini-chain";
import type { AssetDoc } from "./models";
import { MarketIndexModel } from "./models";
import { radarInputOf } from "./radar-service";

// A leitura da semana de um ativo (spec 2026-11-13-leitura-da-semana-design.md): o movimento em 7
// dias (código), o prompt do conselho, a chamada ao Gemini em JSON e a validação. Usada pelo resumo
// da semana da Carteira Alvo (cron de notícias) e pelo modo semana do resumo do dia.

/** Os fechamentos guardados de cada índice (`market_indices.closes`). */
export async function storedIndexCloses(): Promise<Map<MarketIndexId, IndexClose[]>> {
  const docs = await MarketIndexModel.find({}, { closes: 1 }).lean();
  return new Map(docs.map((doc) => [doc._id as MarketIndexId, doc.closes ?? []]));
}

type WeekDoc = Pick<
  AssetDoc,
  | "price"
  | "quoteFetchedAt"
  | "recentCloses"
  | "lastDividend"
  | "dividends12m"
  | "dividendPayments12m"
  | "dividendsFetchedAt"
  | "dividendAnnouncements"
  | "dy12m"
  | "priceToBook"
  | "fundamentalsFetchedAt"
  | "vacancyPct"
  | "fundType"
  | "segment"
  | "paperPct"
  | "realEstatePct"
  | "fundamentusIndicators"
>;

/** O movimento em 7 dias do ativo contra o índice da classe, com os fechamentos guardados. */
export function weekMoveOfDoc(
  doc: Pick<WeekDoc, "price" | "quoteFetchedAt" | "recentCloses"> | null | undefined,
  assetClass: AssetClass | null,
  indexCloses: ReadonlyMap<MarketIndexId, IndexClose[]>,
): WeekMove | null {
  if (!doc) return null;
  const id = marketIndexFor(assetClass);
  return weekMoveOf({
    closes: doc.recentCloses ?? [],
    quote:
      typeof doc.price === "number" && doc.quoteFetchedAt
        ? { price: doc.price, session: quoteSessionDate(doc.quoteFetchedAt) }
        : null,
    assetClass,
    index: { id, closes: indexCloses.get(id) ?? [] },
  });
}

const trendWord = (trend: number | null): DividendTrendWord | null => {
  if (trend === null) return null;
  if (trend >= RADAR.trendUp) return "subindo";
  if (trend <= RADAR.trendDown) return "caindo";
  return "estaveis";
};

export type WeekReadingResult = {
  /** O resumo pronto, ou null: nenhuma chamada começou (`calls` 0) ou nenhuma resposta passou. */
  summary: WeekSummary | null;
  calls: number;
  /** Respostas recusadas pela validação. */
  rejected: number;
  /** O modelo da última resposta (para registrar a falha). */
  model: string | null;
};

/** Até duas respostas por ativo: a recusada pela validação dá uma chance ao próximo modelo. */
const MAX_ATTEMPTS = 2;

/**
 * Gera a leitura da semana de um ativo com as notícias `items` (as de `selectWeekNews`, já com a
 * chave `newsKey`). `models` é a lista compartilhada da cadeia: os modelos esgotados ou fora do ar
 * saem dela para as próximas chamadas.
 */
export async function generateWeekReading(args: {
  apiKey: string;
  models: GeminiModel[];
  ticker: string;
  assetClass: AssetClass | null;
  doc: WeekDoc | null | undefined;
  indexCloses: ReadonlyMap<MarketIndexId, IndexClose[]>;
  items: readonly (NewsItem & { description: string | null })[];
  newsKey: string;
  now: Date;
  deadline: number;
  label: string;
}): Promise<WeekReadingResult> {
  const { doc, assetClass, now } = args;
  const move = weekMoveOfDoc(doc, assetClass, args.indexCloses);
  const input = doc && assetClass ? radarInputOf(doc, assetClass, null, now) : null;
  const sources = doc ? radarSources(doc, now) : null;
  const items: WeekPromptItem[] = args.items.map(
    ({ title, publisher, url, publishedAt, description }) => ({
      title,
      publisher,
      url,
      publishedAt,
      description,
    }),
  );
  const prompt = buildWeekSummaryPrompt({
    ticker: args.ticker,
    assetClass,
    description: input
      ? describeAsset(input)
      : assetClass === "FII"
        ? "um fundo imobiliário"
        : "uma empresa da bolsa",
    now,
    move,
    dividend:
      sources && typeof sources.lastDividendAmount === "number"
        ? { perShare: sources.lastDividendAmount, trend: trendWord(sources.dividendTrend) }
        : null,
    items,
  });
  const options = {
    temperature: WEEK_SUMMARY.temperature,
    maxOutputTokens: WEEK_SUMMARY.maxOutputTokens,
    timeoutMs: WEEK_SUMMARY.timeoutMs,
    responseMimeType: "application/json" as const,
    responseJsonSchema: weekReadingSchema(assetClass),
  };
  const result: WeekReadingResult = { summary: null, calls: 0, rejected: 0, model: null };
  const tried = new Set<GeminiModel>();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const chain = args.models.filter((model) => !tried.has(model));
    if (chain.length === 0) break;
    const before = [...chain];
    const out = await generateWithChain(
      args.apiKey,
      chain,
      prompt,
      options,
      now,
      args.label,
      args.deadline,
    );
    result.calls += out.calls;
    // A cadeia tira da lista local os esgotados e os fora do ar: a compartilhada aprende também.
    for (const model of before) {
      if (!chain.includes(model) && args.models.includes(model)) {
        args.models.splice(args.models.indexOf(model), 1);
      }
    }
    if (!out.result) break;
    result.model = out.result.model;
    tried.add(out.result.model);
    const reading = parseWeekReading(out.result.text, out.result.finishReason, {
      itemCount: items.length,
      assetClass,
      prompt,
    });
    if (reading) {
      result.summary = weekSummaryFromReading({
        reading,
        items,
        move,
        newsKey: args.newsKey,
        moveKey: weekMoveKey(move),
        model: out.result.model,
        now,
      });
      return result;
    }
    result.rejected += 1;
    console.warn(`[${args.label}] resposta recusada pela validação (${out.result.model})`);
  }
  return result;
}
