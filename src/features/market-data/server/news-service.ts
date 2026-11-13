import "server-only";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { mapWithConcurrency } from "@/shared/lib/concurrency";
import { withSpan } from "@/shared/lib/tracing";
import { fetchFeed } from "../adapters/news";
import { parseBingNews } from "../domain/day-insight";
import {
  BING_SOURCE,
  bingSearchUrl,
  COMPANY_FEED_SOURCE,
  feedsDue,
  INFOMONEY_SLUGS,
  infomoneyCompanyUrl,
  NEWS,
  NEWS_SOURCES,
  newsItemFromBing,
  newsItemFromFeed,
  parseRssFeed,
  type NewsItemInput,
  type NewsSource,
} from "../domain/news";
import { NewsFeedModel, NewsItemModel } from "./models";

// Coletor de notícias (spec 2026-11-13-noticias-e-cenario-design.md, Camada 2): os feeds só
// trazem 10 itens, então a semana vem de ler de 30 em 30 min e guardar. Desde 2026-11-13 (spec
// 2026-11-13-leitura-da-semana-design.md), a busca do Bing de cada ativo da Carteira Alvo entra no
// mesmo rodízio (6 h por ticker), para a leitura da semana não depender só dos feeds gerais.

export type NewsSummary = {
  sources: number;
  itemsNew: number;
  itemsMatched: number;
  sourceErrors: number;
  /** Feeds que ficaram para a próxima chamada por falta de tempo. */
  skipped: number;
  /** Buscas do Bing por ativo da Carteira Alvo feitas nesta chamada. */
  bingSearches: number;
};

/** Um feed não começa com menos que isso antes do prazo (timeout de 10 s + gravação). */
const FEED_BUDGET_MS = 11_000;

export const newsIdOf = (url: string) =>
  createHash("sha256").update(url).digest("hex").slice(0, 24);

async function upsertNews(items: readonly NewsItemInput[], now: Date): Promise<number> {
  if (items.length === 0) return 0;
  const result = await NewsItemModel.bulkWrite(
    items.map((item) => ({
      updateOne: {
        filter: { _id: newsIdOf(item.url) },
        update: {
          $setOnInsert: {
            url: item.url,
            title: item.title,
            publisher: item.publisher,
            source: item.source,
            publishedAt: item.publishedAt,
            description: item.description,
            readPage: item.readPage,
            fetchedAt: now,
          },
          $addToSet: { tickers: { $each: item.tickers }, topics: { $each: item.topics } },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  return result.upsertedCount;
}

/**
 * Lê os feeds gerais, os por empresa (rodízio de 2 h) e a busca do Bing de cada ativo de `targets`
 * (a Carteira Alvo, rodízio de 6 h), e guarda as notícias dos acompanhados (`tracked`).
 */
export async function collectNews(
  tracked: readonly string[],
  options: { now?: Date; deadline?: number; targets?: readonly string[] } = {},
): Promise<NewsSummary> {
  const now = options.now ?? new Date();
  const deadline = options.deadline ?? Date.now() + 25_000;
  return withSpan("news.collect", {}, async (span) => {
    await connectMongo();
    await NewsItemModel.init(); // garante os índices (TTL) antes da primeira gravação
    const companies = tracked.flatMap((ticker) =>
      INFOMONEY_SLUGS[ticker]
        ? [{ ticker, url: infomoneyCompanyUrl(INFOMONEY_SLUGS[ticker]) }]
        : [],
    );
    const searches = [...new Set(options.targets ?? [])].map((ticker) => ({
      ticker,
      url: bingSearchUrl(ticker),
    }));
    const states = await NewsFeedModel.find(
      { _id: mongoose.trusted({ $in: [...companies, ...searches].map((feed) => feed.url) }) },
      { fetchedAt: 1 },
    ).lean();
    const lastFetched = new Map(states.map((state) => [state._id, state.fetchedAt]));
    const companyRule = {
      everyHours: NEWS.companyFeedEveryHours,
      perCall: NEWS.companyFeedsPerCall,
    };
    const bingRule = { everyHours: NEWS.bingEveryHours, perCall: NEWS.bingPerCall };
    const jobs: { source: NewsSource; url: string; ticker: string | null }[] = [
      ...NEWS_SOURCES.map((source) => ({ source, url: source.url, ticker: null })),
      ...feedsDue(companies, lastFetched, now, companyRule).map((c) => ({
        source: COMPANY_FEED_SOURCE,
        url: c.url,
        ticker: c.ticker,
      })),
      ...feedsDue(searches, lastFetched, now, bingRule).map((s) => ({
        source: BING_SOURCE,
        url: s.url,
        ticker: s.ticker,
      })),
    ];
    const summary: NewsSummary = {
      sources: 0,
      itemsNew: 0,
      itemsMatched: 0,
      sourceErrors: 0,
      skipped: 0,
      bingSearches: 0,
    };
    await mapWithConcurrency(jobs, NEWS.feedConcurrency, async (job) => {
      if (Date.now() > deadline - FEED_BUDGET_MS) {
        summary.skipped += 1;
        return;
      }
      summary.sources += 1;
      try {
        const xml = await fetchFeed(job.url);
        const items: NewsItemInput[] = [];
        if (job.source.id === BING_SOURCE.id && job.ticker) {
          summary.bingSearches += 1;
          for (const item of parseBingNews(xml)) {
            const input = newsItemFromBing(item, job.ticker, tracked, now);
            if (input) items.push(input);
          }
        } else {
          for (const item of parseRssFeed(xml)) {
            const input = newsItemFromFeed(item, job.source, tracked, now, job.ticker);
            if (input) items.push(input);
          }
        }
        // Guarda o resultado antes de somar: `+= await` lê o total antes da espera e perde contagens
        // dos outros workers.
        const inserted = await upsertNews(items, now);
        summary.itemsNew += inserted;
        summary.itemsMatched += items.filter((item) => item.tickers.length > 0).length;
        await NewsFeedModel.updateOne(
          { _id: job.url },
          { $set: { fetchedAt: now, ok: true, error: null, items: items.length } },
          { upsert: true },
        );
      } catch (error) {
        summary.sourceErrors += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.warn("[notícias]", message);
        // A falha também conta como leitura: o rodízio segue e o feed volta em 2 h.
        await NewsFeedModel.updateOne(
          { _id: job.url },
          { $set: { fetchedAt: now, ok: false, error: message, items: 0 } },
          { upsert: true },
        );
      }
    });
    span.setAttributes({
      "koinos.news.sources": summary.sources,
      "koinos.news.items_new": summary.itemsNew,
      "koinos.news.items_matched": summary.itemsMatched,
      "koinos.news.source_errors": summary.sourceErrors,
      "koinos.news.skipped": summary.skipped,
      "koinos.news.bing_searches": summary.bingSearches,
    });
    return summary;
  });
}
