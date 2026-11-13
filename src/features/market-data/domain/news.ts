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
