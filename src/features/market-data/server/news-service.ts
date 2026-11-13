import "server-only";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { mapWithConcurrency } from "@/shared/lib/concurrency";
import { withSpan } from "@/shared/lib/tracing";
import { fetchFeed } from "../adapters/news";
import {
  COMPANY_FEED_SOURCE,
  companyFeedsDue,
  INFOMONEY_SLUGS,
  infomoneyCompanyUrl,
  NEWS,
  NEWS_SOURCES,
  newsItemFromFeed,
  parseRssFeed,
  type NewsItemInput,
  type NewsSource,
} from "../domain/news";
import { NewsFeedModel, NewsItemModel } from "./models";

// Coletor de notícias (spec 2026-11-13-noticias-e-cenario-design.md, Camada 2): os feeds só
// trazem 10 itens, então a semana vem de ler de 30 em 30 min e guardar.

export type NewsSummary = {
  sources: number;
  itemsNew: number;
  itemsMatched: number;
  sourceErrors: number;
  /** Feeds que ficaram para a próxima chamada por falta de tempo. */
  skipped: number;
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

export async function collectNews(
  tracked: readonly string[],
  options: { now?: Date; deadline?: number } = {},
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
    const states = await NewsFeedModel.find(
      { _id: mongoose.trusted({ $in: companies.map((c) => c.url) }) },
      { fetchedAt: 1 },
    ).lean();
    const lastFetched = new Map(states.map((state) => [state._id, state.fetchedAt]));
    const jobs: { source: NewsSource; url: string; ticker: string | null }[] = [
      ...NEWS_SOURCES.map((source) => ({ source, url: source.url, ticker: null })),
      ...companyFeedsDue(companies, lastFetched, now).map((c) => ({
        source: COMPANY_FEED_SOURCE,
        url: c.url,
        ticker: c.ticker,
      })),
    ];
    const summary: NewsSummary = {
      sources: 0,
      itemsNew: 0,
      itemsMatched: 0,
      sourceErrors: 0,
      skipped: 0,
    };
    await mapWithConcurrency(jobs, NEWS.feedConcurrency, async (job) => {
      if (Date.now() > deadline - FEED_BUDGET_MS) {
        summary.skipped += 1;
        return;
      }
      summary.sources += 1;
      try {
        const items = parseRssFeed(await fetchFeed(job.url)).flatMap((item) => {
          const input = newsItemFromFeed(item, job.source, tracked, now, job.ticker);
          return input ? [input] : [];
        });
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
    });
    return summary;
  });
}
