import "server-only";
import type { CatalogEntry, Quote, QuoteBatch, QuoteProvider } from "../ports";

const BASE_URL = "https://brapi.dev/api";
const TIMEOUT_MS = 10_000;
const MAX_PAGES = 10;

type ListItem = {
  stock: string;
  name: string | null;
  close: number | null;
  change: number | null;
  logo: string | null;
  type: string | null;
  subType: string | null;
};
type ListResponse = { stocks?: ListItem[]; hasNextPage?: boolean };
type QuoteV2Response = {
  results?: {
    symbol: string;
    data?: {
      regularMarketPrice?: number;
      regularMarketChangePercent?: number;
      longName?: string;
      shortName?: string;
      logourl?: string;
      regularMarketTime?: string;
    };
  }[];
};

export type BrapiDeps = {
  token?: string;
  /** Chamado antes de cada requisição HTTP (contador da cota mensal). */
  onRequest?: () => Promise<void>;
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

function fromListItem(item: ListItem): Quote {
  return {
    ticker: item.stock,
    price: item.close!,
    changePercent: typeof item.change === "number" ? item.change / 100 : null,
    // Na listagem, o nome de fundos costuma vir igual ao ticker: nesse caso não serve.
    name: item.name && item.name !== item.stock ? item.name : null,
    logoUrl: item.logo,
    subType: item.subType,
    quoteTime: null,
  };
}

export function createBrapiClient(deps: BrapiDeps) {
  async function request<T>(path: string): Promise<T> {
    await deps.onRequest?.();
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: deps.token ? { Authorization: `Bearer ${deps.token}` } : {},
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`brapi respondeu ${response.status}`);
    return (await response.json()) as T;
  }

  /**
   * Listagem em lote: uma página traz até 1000 ativos com preço, variação, logo e subtipo.
   * `onPage` pode devolver true para parar de paginar.
   */
  async function listAll(
    type: "fund" | "stock",
    onPage?: (items: ListItem[]) => boolean,
  ): Promise<ListItem[]> {
    const all: ListItem[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = await request<ListResponse>(`/quote/list?type=${type}&limit=1000&page=${page}`);
      const items = data.stocks ?? [];
      all.push(...items);
      if (onPage?.(items) || !data.hasNextPage) break;
    }
    return all;
  }

  /** Cotação individual (v2). Exige token para FIIs; 1 ticker por requisição no plano gratuito. */
  async function quoteOne(ticker: string): Promise<Quote | null> {
    const data = await request<QuoteV2Response>(
      `/v2/stocks/quote?symbols=${encodeURIComponent(ticker)}`,
    );
    const quote = data.results?.[0]?.data;
    if (!quote || typeof quote.regularMarketPrice !== "number" || quote.regularMarketPrice <= 0) {
      return null;
    }
    return {
      ticker,
      price: quote.regularMarketPrice,
      changePercent:
        typeof quote.regularMarketChangePercent === "number"
          ? quote.regularMarketChangePercent / 100
          : null,
      name: quote.longName ?? quote.shortName ?? null,
      logoUrl: quote.logourl ?? null,
      subType: null,
      quoteTime: quote.regularMarketTime ? new Date(quote.regularMarketTime) : null,
    };
  }

  const provider: QuoteProvider = {
    name: "brapi",
    async getQuotes(tickers) {
      const wanted = new Set(tickers);
      const quotes = new Map<string, Quote>();
      const failed = new Map<string, string>();

      const collect = (items: ListItem[]) => {
        for (const item of items) {
          if (wanted.has(item.stock) && typeof item.close === "number" && item.close > 0) {
            quotes.set(item.stock, fromListItem(item));
          }
        }
        return quotes.size === wanted.size;
      };

      try {
        // Fundos (FIIs, Fiagros, ETFs) numa requisição; ações só se ainda faltar alguém.
        if (!collect(await listAll("fund"))) await listAll("stock", collect);
      } catch (error) {
        console.warn("[brapi] listagem falhou:", errorMessage(error));
      }

      const missing = [...wanted].filter((ticker) => !quotes.has(ticker));
      for (const ticker of missing) {
        if (!deps.token) {
          failed.set(ticker, "não encontrado na listagem");
          continue;
        }
        // Uma requisição por vez: o plano gratuito não permite requisições simultâneas.
        try {
          const quote = await quoteOne(ticker);
          if (quote) quotes.set(ticker, quote);
          else failed.set(ticker, "sem cotação");
        } catch (error) {
          failed.set(ticker, errorMessage(error));
        }
      }
      return { quotes, failed } satisfies QuoteBatch;
    },
  };

  /** Catálogo de tickers da B3 (fundos e ações), para o autocomplete. */
  async function fetchCatalog(): Promise<CatalogEntry[]> {
    const items = [...(await listAll("fund")), ...(await listAll("stock"))];
    const byTicker = new Map<string, CatalogEntry>();
    for (const item of items) {
      byTicker.set(item.stock, {
        ticker: item.stock,
        name: item.name ?? item.stock,
        type: item.type,
        subType: item.subType,
        logoUrl: item.logo,
      });
    }
    return [...byTicker.values()];
  }

  return { ...provider, fetchCatalog };
}
