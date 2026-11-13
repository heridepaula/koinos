// Notícias da semana (spec 2026-11-13-noticias-e-cenario-design.md, Camada 2): leitura dos
// feeds RSS, URL normalizada e ligação da notícia aos ativos acompanhados. Puro.

export const NEWS = {
  maxDescriptionChars: 400,
  /** As notícias ficam guardadas por 14 dias (TTL do `news_items`). */
  keepDays: 14,
  /** Data no futuro aceita (relógio do portal adiantado). */
  futureToleranceMs: 3_600_000,
  /** Cada feed por empresa é lido no máximo a cada 2 h, até 4 por chamada. */
  companyFeedEveryHours: 2,
  companyFeedsPerCall: 4,
  /** Feeds lidos ao mesmo tempo. */
  feedConcurrency: 3,
} as const;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const value =
        code[1] === "x" || code[1] === "X"
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** O conteúdo de `<name>` dentro de um item, sem CDATA e com as entidades decodificadas. */
export const rssTag = (item: string, name: string): string | null => {
  const match = item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  if (!match) return null;
  const raw = match[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1");
  return decodeEntities(raw).trim();
};

/** A URL sem `utm_*` nem fragmento, ou null quando não é http(s). */
export function normalizeNewsUrl(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
  }
  return url.toString();
}

const WORDPRESS_FOOTER =
  /\s*(The post|O post)\s[\s\S]*?(appeared first on|apareceu primeiro em)[\s\S]*$/i;

/** O resumo sem HTML nem o rodapé do WordPress, até 400 caracteres; null quando vazio. */
export function cleanDescription(raw: string | null): string | null {
  if (!raw) return null;
  const text = decodeEntities(raw.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .replace(WORDPRESS_FOOTER, "")
    .trim();
  if (!text) return null;
  const max = NEWS.maxDescriptionChars;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export type FeedItem = {
  title: string;
  url: string;
  publishedAt: Date;
  description: string | null;
};

/**
 * Os itens de um feed RSS, do mais novo ao mais velho. Item sem título, sem URL http(s) ou sem
 * data válida fica de fora; URL repetida, também.
 */
export function parseRssFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const seen = new Set<string>();
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const body = match[1];
    const title = rssTag(body, "title")
      ?.replace(/<[^>]*>/g, "")
      .trim();
    const link = rssTag(body, "link") || rssTag(body, "guid");
    const date = rssTag(body, "pubDate");
    const url = link ? normalizeNewsUrl(link) : null;
    const publishedAt = date ? new Date(date) : null;
    if (!title || !url || !publishedAt || Number.isNaN(publishedAt.getTime())) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    items.push({
      title,
      url,
      publishedAt,
      description: cleanDescription(rssTag(body, "description")),
    });
  }
  return items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

export type NewsTopic = "ativo" | "cenario";
export type NewsSourceId =
  "suno" | "fiis" | "infomoney" | "infomoney-empresa" | "moneytimes" | "moneytimes-politica";

export type NewsSource = {
  id: NewsSourceId;
  url: string;
  publisher: string;
  topics: readonly NewsTopic[];
  /** A Suno bloqueia robôs de IA no robots.txt: só título e resumo do RSS, nunca a página. */
  readPage: boolean;
};

/** Os feeds gerais, testados em 2026-11-13 (10 itens cada). */
export const NEWS_SOURCES: readonly NewsSource[] = [
  {
    id: "suno",
    url: "https://www.suno.com.br/noticias/feed/",
    publisher: "Suno",
    topics: ["ativo"],
    readPage: false,
  },
  {
    id: "fiis",
    url: "https://fiis.com.br/noticias/feed/",
    publisher: "FIIs.com.br",
    topics: ["ativo"],
    readPage: true,
  },
  {
    id: "infomoney",
    url: "https://www.infomoney.com.br/feed/",
    publisher: "InfoMoney",
    topics: ["ativo", "cenario"],
    readPage: true,
  },
  {
    id: "moneytimes",
    url: "https://www.moneytimes.com.br/feed/",
    publisher: "Money Times",
    topics: ["ativo", "cenario"],
    readPage: true,
  },
  {
    id: "moneytimes-politica",
    url: "https://www.moneytimes.com.br/category/politica/feed/",
    publisher: "Money Times",
    topics: ["cenario"],
    readPage: true,
  },
];

/** O feed da InfoMoney de uma empresa (só ativos). */
export const COMPANY_FEED_SOURCE: NewsSource = {
  id: "infomoney-empresa",
  url: "",
  publisher: "InfoMoney",
  topics: ["ativo"],
  readPage: true,
};

/** Slugs de `infomoney.com.br/tudo-sobre/<slug>/feed/`, testados em 2026-11-13 (SEER3 dá 404). */
export const INFOMONEY_SLUGS: Readonly<Record<string, string>> = {
  PETR4: "petrobras",
  VALE3: "vale",
  BBAS3: "banco-do-brasil",
  BBSE3: "bb-seguridade",
  ITSA4: "itausa",
  EGIE3: "engie-brasil",
  AXIA7: "axia",
  UNIP6: "unipar",
  SLCE3: "slc-agricola",
  AGRO3: "brasilagro",
  TUPY3: "tupy",
};

export const infomoneyCompanyUrl = (slug: string) =>
  `https://www.infomoney.com.br/tudo-sobre/${slug}/feed/`;

/** Nomes que identificam o ativo sem o ticker, com caixa exata ("Vale" sozinho fica de fora). */
export const NEWS_ALIASES: Readonly<Record<string, readonly string[]>> = {
  PETR4: ["Petrobras"],
  VALE3: ["Vale S.A.", "mineradora Vale"],
  BBAS3: ["Banco do Brasil"],
  BBSE3: ["BB Seguridade"],
  ITSA4: ["Itaúsa"],
  EGIE3: ["Engie Brasil"],
  AXIA7: ["Axia Energia", "Eletrobras"],
  UNIP6: ["Unipar"],
  SLCE3: ["SLC Agrícola"],
  AGRO3: ["BrasilAgro"],
  TUPY3: ["Tupy"],
};

const TICKER = /(?<![A-Z0-9])([A-Z]{4})(\d{1,2})(?![A-Z0-9])/g;
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Os tickers acompanhados citados no texto: o código exato, a família (PETR3 → PETR4) e os apelidos. */
export function matchTickers(
  text: string,
  tracked: readonly string[],
  aliases: Readonly<Record<string, readonly string[]>> = NEWS_ALIASES,
): string[] {
  const found = new Set<string>();
  const families = new Map<string, string[]>();
  for (const ticker of tracked) {
    const family = ticker.slice(0, 4);
    families.set(family, [...(families.get(family) ?? []), ticker]);
  }
  for (const match of text.matchAll(TICKER)) {
    const code = match[1] + match[2];
    if (tracked.includes(code)) found.add(code);
    else for (const ticker of families.get(match[1]) ?? []) found.add(ticker);
  }
  for (const ticker of tracked) {
    for (const alias of aliases[ticker] ?? []) {
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegExp(alias)}(?![\\p{L}\\p{N}])`,
        "u",
      );
      if (pattern.test(text)) found.add(ticker);
    }
  }
  return [...found].sort();
}

export type NewsItemInput = {
  url: string;
  title: string;
  publisher: string;
  source: NewsSourceId;
  publishedAt: Date;
  description: string | null;
  tickers: string[];
  topics: NewsTopic[];
  readPage: boolean;
};

const DAY_MS = 86_400_000;

/**
 * O item a guardar, ou null: velho demais, no futuro, ou sem tópico (feed de ativos sem ticker
 * acompanhado). `companyTicker` é o ativo do feed por empresa, ligado mesmo sem ser citado.
 */
export function newsItemFromFeed(
  item: FeedItem,
  source: NewsSource,
  tracked: readonly string[],
  now: Date,
  companyTicker: string | null = null,
): NewsItemInput | null {
  const age = now.getTime() - item.publishedAt.getTime();
  if (age > NEWS.keepDays * DAY_MS || -age > NEWS.futureToleranceMs) return null;
  const tickers = matchTickers(`${item.title} ${item.description ?? ""}`, tracked);
  if (companyTicker && !tickers.includes(companyTicker)) {
    tickers.push(companyTicker);
    tickers.sort();
  }
  const topics: NewsTopic[] = [];
  if (source.topics.includes("ativo") && tickers.length > 0) topics.push("ativo");
  if (source.topics.includes("cenario")) topics.push("cenario");
  if (topics.length === 0) return null;
  return {
    url: item.url,
    title: item.title,
    publisher: source.publisher,
    source: source.id,
    publishedAt: item.publishedAt,
    description: item.description,
    tickers,
    topics,
    readPage: source.readPage,
  };
}

/** Os feeds por empresa a ler agora: nunca lidos ou lidos há 2 h ou mais, os mais antigos primeiro. */
export function companyFeedsDue<T extends { url: string }>(
  feeds: readonly T[],
  lastFetched: ReadonlyMap<string, Date>,
  now: Date,
): T[] {
  const limit = now.getTime() - NEWS.companyFeedEveryHours * 3_600_000;
  const time = (feed: T) => lastFetched.get(feed.url)?.getTime() ?? Number.NEGATIVE_INFINITY;
  return feeds
    .filter((feed) => time(feed) <= limit)
    .sort((a, b) => time(a) - time(b))
    .slice(0, NEWS.companyFeedsPerCall);
}
