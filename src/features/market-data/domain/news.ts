import type { NewsItem } from "./day-insight";

// Notícias da semana (spec 2026-11-13-noticias-e-cenario-design.md, Camada 2): leitura dos
// feeds RSS, URL normalizada e ligação da notícia aos ativos acompanhados. Desde 2026-11-13 (spec
// 2026-11-13-leitura-da-semana-design.md), também a busca do Bing por ativo da Carteira Alvo. Puro.

export const NEWS = {
  maxDescriptionChars: 400,
  /** As notícias ficam guardadas por 14 dias (TTL do `news_items`). */
  keepDays: 14,
  /** Data no futuro aceita (relógio do portal adiantado). */
  futureToleranceMs: 3_600_000,
  /** Cada feed por empresa é lido no máximo a cada 2 h, até 4 por chamada. */
  companyFeedEveryHours: 2,
  companyFeedsPerCall: 4,
  /** A busca do Bing de cada ativo da Carteira Alvo: a cada 6 h por ticker, até 4 por chamada. */
  bingEveryHours: 6,
  bingPerCall: 4,
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
  // Aceita atributos na abertura (`<guid isPermaLink="true">`).
  const match = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  if (!match) return null;
  // Desembrulha todos os CDATA (um "]]>" no texto faz o feed dividir em vários) e ignora os
  // espaços e quebras de linha em volta deles.
  const raw = match[1].trim().replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
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

/**
 * Tags HTML de verdade: `<` seguido de letra, `/` ou `!`. Um "< 10%" no texto não é tag. Os valores
 * entre aspas são pulados inteiros: a InfoMoney põe HTML dentro de `data-image-caption`, e o `>` de
 * dentro dele cortava a tag no meio (sobrava `" data-large-file="…" />` no resumo).
 */
const HTML_TAG = /<\/?[a-z!](?:[^>"']|"[^"]*"|'[^']*')*>/gi;

// Sem a flag `i` e com o início ou um espaço antes: "no post do Instagram" e "compost" não cortam.
const FOOTER_START = /(?:^|\s)(?:The post|O post)\s/g;
const FOOTER_END = /appeared first on|apareceu primeiro em/;

/** Corta o rodapé do WordPress a partir do ÚLTIMO "The post …" que chega a "appeared first on …". */
function stripWordPressFooter(text: string): string {
  const starts = [...text.matchAll(FOOTER_START)].map((match) => match.index);
  for (let i = starts.length - 1; i >= 0; i -= 1) {
    if (FOOTER_END.test(text.slice(starts[i]))) return text.slice(0, starts[i]);
  }
  return text;
}

/** O resumo sem HTML nem o rodapé do WordPress, até 400 caracteres; null quando vazio. */
export function cleanDescription(raw: string | null): string | null {
  if (!raw) return null;
  const text = stripWordPressFooter(
    decodeEntities(raw.replace(HTML_TAG, " ")).replace(/\s+/g, " "),
  ).trim();
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
    const title = rssTag(body, "title")?.replace(HTML_TAG, "").trim();
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
  | "suno"
  | "fiis"
  | "infomoney"
  | "infomoney-empresa"
  | "moneytimes"
  | "moneytimes-politica"
  | "bing";

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

/**
 * A busca do Bing Notícias por ticker (só ativos da Carteira Alvo). O portal de cada item vem do
 * próprio Bing, e quem pode ter a página lida é decidido pelo host (`canReadPage`).
 */
export const BING_SOURCE: NewsSource = {
  id: "bing",
  url: "",
  publisher: "Bing Notícias",
  topics: ["ativo"],
  readPage: true,
};

/** A busca do ticker no RSS do Bing Notícias, em pt-BR. É também a chave do rodízio. */
export const bingSearchUrl = (ticker: string) =>
  `https://www.bing.com/news/search?q=${encodeURIComponent(ticker)}&format=rss&setlang=pt-BR&cc=BR`;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};

/** Os hosts das fontes que nunca têm a página lida (a Suno: `robots.txt` bloqueia robôs de IA). */
const NO_READ_HOSTS = NEWS_SOURCES.filter((source) => !source.readPage).flatMap((source) => {
  const host = hostOf(source.url);
  return host ? [host] : [];
});

/** A página pode ser lida? Não nos hosts sem leitura (e subdomínios) nem numa URL inválida. */
export function canReadPage(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return !NO_READ_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

/** Uma notícia do RSS do Bing, com o resumo (`<description>`) limpo. */
export type BingNewsItem = NewsItem & { description: string | null };

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

/**
 * O item do Bing a guardar, ou null: velho demais, no futuro, ou sem citar o ticker buscado (um
 * resultado sem relação). Os outros acompanhados citados também são ligados; a página só é lida
 * quando o host permite (a Suno vinda do Bing, não).
 */
export function newsItemFromBing(
  item: BingNewsItem,
  ticker: string,
  tracked: readonly string[],
  now: Date,
): NewsItemInput | null {
  const age = now.getTime() - item.publishedAt.getTime();
  if (age > NEWS.keepDays * DAY_MS || -age > NEWS.futureToleranceMs) return null;
  const tickers = matchTickers(`${item.title} ${item.description ?? ""}`, [
    ...new Set([...tracked, ticker]),
  ]);
  if (!tickers.includes(ticker)) return null;
  return {
    url: item.url,
    title: item.title,
    publisher: item.publisher,
    source: BING_SOURCE.id,
    publishedAt: item.publishedAt,
    description: item.description,
    tickers,
    topics: ["ativo"],
    readPage: canReadPage(item.url),
  };
}

/**
 * Os feeds a ler agora, num rodízio: nunca lidos ou lidos há `everyHours` ou mais, os mais antigos
 * primeiro, até `perCall`. Serve aos feeds por empresa (2 h, 4) e à busca do Bing (6 h, 4).
 */
export function feedsDue<T extends { url: string }>(
  feeds: readonly T[],
  lastFetched: ReadonlyMap<string, Date>,
  now: Date,
  rule: { everyHours: number; perCall: number },
): T[] {
  const limit = now.getTime() - rule.everyHours * 3_600_000;
  const time = (feed: T) => lastFetched.get(feed.url)?.getTime() ?? Number.NEGATIVE_INFINITY;
  return feeds
    .filter((feed) => time(feed) <= limit)
    .sort((a, b) => time(a) - time(b))
    .slice(0, rule.perCall);
}
