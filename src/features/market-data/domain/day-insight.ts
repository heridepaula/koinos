import { saoPauloParts, saoPauloToUtc } from "@/shared/lib/time";
import type { AssetClass } from "./asset-class";
import type { MarketIndexId } from "./market-indices";
import { normalizeNewsUrl, rssTag } from "./news";

// Resumo da IA para variações fortes do dia (spec 2026-11-12-resumo-ia-variacao-design.md).
// Regras puras: gatilho, leitura do RSS do Bing, horários das novas tentativas e o prompt. Só
// dados públicos entram aqui: nenhum dado de carteira chega ao Gemini. Desde 2026-11-13 (plano
// 2026-11-13-resumo-dia-sem-noticia-antiga.md): só notícia do pregão explica o movimento; sem
// ela, o resumo vira "o que aconteceu nesta semana", e a comparação com o índice é do código.

export const DAY_INSIGHT = {
  /** |variação do dia| (fração) que dispara o resumo, por classe. O limite exato dispara. */
  threshold: { FII: 0.02, ACAO: 0.03 } satisfies Record<AssetClass, number>,
  /**
   * Nada antes das 10:30 do dia do pregão: nos primeiros minutos a brapi (15–30 min de atraso)
   * ainda traz a variação do pregão anterior.
   */
  settleMinutes: 10 * 60 + 30,
  /** Sem notícia do dia, uma nova tentativa a cada 30 min. */
  retryMinutes: 30,
  /** Tenta de novo até 12:00; volta das 18:00 às 20:00 (São Paulo). */
  morningUntilMinutes: 12 * 60,
  afterCloseFromMinutes: 18 * 60,
  finalAtMinutes: 20 * 60,
  /** Páginas de notícia lidas por resumo e o corte do texto de cada uma. */
  articles: 3,
  articleChars: 4000,
  /** Notícias de até 7 dias entram na lista. */
  maxNewsAgeDays: 7,
  /** Notícias usadas no resumo da semana. */
  weekItems: 5,
  /** Uma variação abaixo disso (fração, 0,005%) "ficou estável". */
  stableBelow: 0.00005,
} as const;

/**
 * A cadeia de modelos do free tier, do mais barato que atende ao mais caro. A cota gratuita é por
 * modelo e por projeto, então cada um tem o seu contador diário.
 *
 * Teste de 2026-11-12 com o prompt real (uma notícia do HGLG11): os Lite fizeram um resumo correto
 * e claro em 1 a 2 s, sem tokens de raciocínio; o 3.6 Flash, de qualidade parecida, levou 8 s e
 * gastou 1.305 tokens de raciocínio. Resumir 3 notícias em 4 frases não pede mais que um Lite.
 * Os Flash ficam de reserva (503 ou cota esgotada dos Lite), com teto baixo, para sobrar cota a
 * outros usos. As cotas são relatos de desenvolvedores (~500/dia nos Lite, ~20 nos Flash), com
 * folga, não números oficiais. Os 2.5 respondem 404 para contas novas e os omni têm cota 0. Os
 * apelidos `*-latest` ficam de fora: apontam para um destes e dividiriam a mesma cota.
 */
export const GEMINI_MODELS = [
  { id: "gemini-3.5-flash-lite", dailyQuota: 450 },
  { id: "gemini-3.1-flash-lite", dailyQuota: 450 },
  { id: "gemini-3-flash-preview", dailyQuota: 5 },
  { id: "gemini-3.6-flash", dailyQuota: 5 },
  { id: "gemini-3.7-flash", dailyQuota: 5 },
  { id: "gemini-3.8-flash", dailyQuota: 5 },
] as const;

export type GeminiModel = (typeof GEMINI_MODELS)[number]["id"];

/**
 * Os modelos que ainda têm cota hoje, na ordem da cadeia. `used` é o contador do dia de cada um;
 * um modelo que respondeu 429 hoje é marcado com a cota cheia pelo servidor.
 */
export function availableModels(used: (model: GeminiModel) => number): GeminiModel[] {
  return GEMINI_MODELS.filter((model) => used(model.id) < model.dailyQuota).map(
    (model) => model.id,
  );
}

/**
 * Qual limite o corpo de um 429 do Gemini estourou: `day` (cota diária, `PerDay` no `quotaId`),
 * `minute` (limite por minuto, 15/min por modelo no free tier) ou `unknown` (corpo ilegível ou sem
 * `quotaId` conhecido). Se houver os dois, vale o diário.
 */
export function geminiLimitScope(body: unknown): "day" | "minute" | "unknown" {
  const details = (body as { error?: { details?: unknown } } | null | undefined)?.error?.details;
  if (!Array.isArray(details)) return "unknown";
  const ids: string[] = [];
  for (const detail of details) {
    const violations = (detail as { violations?: unknown } | null)?.violations;
    if (!Array.isArray(violations)) continue;
    for (const violation of violations) {
      const id = (violation as { quotaId?: unknown } | null)?.quotaId;
      if (typeof id === "string") ids.push(id);
    }
  }
  if (ids.some((id) => id.includes("PerDay"))) return "day";
  if (ids.some((id) => id.includes("PerMinute"))) return "minute";
  return "unknown";
}

/** Uma notícia do RSS do Bing. */
export type NewsItem = {
  title: string;
  publisher: string;
  /** A URL do portal (não a do redirecionamento do Bing). */
  url: string;
  publishedAt: Date;
};

/** Uma notícia lida, com o texto extraído da página. */
export type NewsArticle = NewsItem & { text: string };

/** Uma notícia candidata ao resumo: do `news_items` ou do Bing (sem resumo, página lida). */
export type InsightNews = NewsItem & {
  description: string | null;
  /** false (Suno): a página nunca é lida; o título e o resumo do RSS fazem as vezes do texto. */
  readPage: boolean;
};

/** Uma notícia guardada no `news_items`. */
export type StoredNews = InsightNews & { topics: readonly string[] };

export type DayInsightStatus = "ok" | "no-news" | "failed";

/** "day": notícias do pregão explicam o movimento; "week": o que aconteceu nesta semana. */
export type DayInsightKind = "day" | "week";

export type MarketReadingKind = "acompanhou" | "descolou";

/** O ativo contra o índice do mercado no mesmo pregão (IFIX para FII, Ibovespa para ação). */
export type MarketReading = {
  index: MarketIndexId;
  indexChange: number;
  reading: MarketReadingKind;
};

/** O resumo guardado no ativo: um por pregão e por movimento (sinal da variação). */
export type DayInsight = {
  /** O pregão (data de negócio) da variação. */
  session: Date;
  changePercent: number;
  kind: DayInsightKind;
  /** "ok": texto do Gemini; "no-news": nenhuma notícia lida; "failed": o Gemini falhou. */
  status: DayInsightStatus;
  text: string | null;
  /** O resumo é do dia (`kind: "day"`) e deu certo: encerra as novas tentativas. */
  sameDay: boolean;
  sources: NewsItem[];
  /** A leitura contra o índice, calculada pelo código; null sem índice do mesmo pregão. */
  market: MarketReading | null;
  model: string | null;
  generatedAt: Date | null;
  attemptedAt: Date;
};

/** Documentos anteriores a 2026-11-13 não têm `kind` nem `market`: leem como "day", sem mercado. */
export function withInsightDefaults(
  raw: Omit<DayInsight, "kind" | "market"> & Partial<Pick<DayInsight, "kind" | "market">>,
): DayInsight {
  return { ...raw, kind: raw.kind ?? "day", market: raw.market ?? null };
}

/** O resumo guardado é deste movimento: mesmo pregão e mesmo sinal da variação atual. */
export function sameMovement(
  insight: DayInsight | null | undefined,
  session: Date,
  changePercent: number,
): boolean {
  if (!insight || insight.session.getTime() !== session.getTime()) return false;
  return Math.sign(insight.changePercent) === Math.sign(changePercent);
}

/** A variação do dia passa do limite da classe. Sem classe, vale o limite das ações. */
export function crossesThreshold(
  assetClass: AssetClass | null,
  changePercent: number | null | undefined,
): boolean {
  if (changePercent === null || changePercent === undefined || !Number.isFinite(changePercent)) {
    return false;
  }
  // Arredonda em 1e-9 para 0,02 vindo da API como 0,019999999 disparar.
  const magnitude = Math.round(Math.abs(changePercent) * 1e9) / 1e9;
  return magnitude >= DAY_INSIGHT.threshold[assetClass ?? "ACAO"];
}

/** A URL do portal: o parâmetro `url=` do link `apiclick.aspx` do Bing, ou o próprio link. */
function portalUrl(link: string): string | null {
  let candidate = link;
  try {
    const parsed = new URL(link);
    const inner = parsed.searchParams.get("url");
    if (inner) candidate = inner;
  } catch {
    return null;
  }
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * As notícias do RSS do Bing (`format=rss`), da mais recente para a mais antiga. Itens sem
 * título, sem URL http(s) ou sem data válida ficam de fora; URLs repetidas, também.
 */
export function parseBingNews(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const seen = new Set<string>();
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const body = match[1];
    const title = rssTag(body, "title");
    const link = rssTag(body, "link");
    const date = rssTag(body, "pubDate");
    const url = link ? portalUrl(link) : null;
    const publishedAt = date ? new Date(date) : null;
    if (!title || !url || !publishedAt || Number.isNaN(publishedAt.getTime())) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    const publisher = rssTag(body, "News:Source") ?? new URL(url).hostname.replace(/^www\./, "");
    items.push({ title, publisher, url, publishedAt });
  }
  return items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

/** Só as notícias de até `maxNewsAgeDays` antes de `now`. */
export function recentNews(items: readonly NewsItem[], now: Date): NewsItem[] {
  const from = now.getTime() - DAY_INSIGHT.maxNewsAgeDays * 86_400_000;
  return items.filter((item) => item.publishedAt.getTime() >= from);
}

/**
 * A notícia é do pregão (data de negócio, meia-noite UTC): publicada a partir do fechamento do
 * pregão anterior (18:00 de São Paulo do dia útil anterior; na segunda, desde sexta 18:00) e até o
 * fim do dia do pregão (23:59:59 de São Paulo). Só ela explica o movimento.
 */
export function isSessionNews(publishedAt: Date, session: Date): boolean {
  const previous = new Date(session.getTime());
  do {
    previous.setUTCDate(previous.getUTCDate() - 1);
  } while (previous.getUTCDay() === 0 || previous.getUTCDay() === 6);
  const from = saoPauloToUtc(
    previous.getUTCFullYear(),
    previous.getUTCMonth() + 1,
    previous.getUTCDate(),
    18,
    0,
  );
  const until = saoPauloToUtc(
    session.getUTCFullYear(),
    session.getUTCMonth() + 1,
    session.getUTCDate() + 1,
    0,
    0,
  );
  const time = publishedAt.getTime();
  return time >= from.getTime() && time < until.getTime();
}

const urlKey = (url: string) => normalizeNewsUrl(url) ?? url;
const newestFirst = (a: NewsItem, b: NewsItem) => b.publishedAt.getTime() - a.publishedAt.getTime();
const toInsightNews = ({
  title,
  publisher,
  url,
  publishedAt,
  description,
  readPage,
}: InsightNews): InsightNews => ({ title, publisher, url, publishedAt, description, readPage });

/**
 * As notícias do pregão: as guardadas do ticker e as do Bing que passam em `isSessionNews`, sem URL
 * repetida (a guardada vence, porque sabe se a página pode ser lida), da mais nova à mais velha.
 */
export function mergeSessionNews(
  stored: readonly StoredNews[],
  bing: readonly NewsItem[],
  session: Date,
): InsightNews[] {
  const seen = new Set<string>();
  const merged: InsightNews[] = [];
  const candidates: InsightNews[] = [
    ...stored.map(toInsightNews),
    ...bing.map((item) => ({ ...item, description: null, readPage: true })),
  ];
  for (const item of candidates) {
    if (!isSessionNews(item.publishedAt, session)) continue;
    const key = urlKey(item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.sort(newestFirst);
}

/** As notícias da semana: as guardadas do ticker com tópico `ativo` dos últimos 7 dias, até 5. */
export function weekNews(stored: readonly StoredNews[], now: Date): InsightNews[] {
  const from = now.getTime() - DAY_INSIGHT.maxNewsAgeDays * 86_400_000;
  return stored
    .filter((item) => item.topics.includes("ativo") && item.publishedAt.getTime() >= from)
    .sort(newestFirst)
    .slice(0, DAY_INSIGHT.weekItems)
    .map(toInsightNews);
}

/**
 * Lê as notícias na ordem dada até conseguir `DAY_INSIGHT.articles`: uma que falha (rede, status,
 * sem texto) é pulada e entra a próxima. Uma de cada vez, porque os sites são de terceiros.
 */
export async function readFirstArticles<T extends NewsItem>(
  items: readonly T[],
  read: (item: T) => Promise<string | null>,
): Promise<{ articles: (T & { text: string })[]; failed: number }> {
  const articles: (T & { text: string })[] = [];
  let failed = 0;
  for (const item of items) {
    if (articles.length >= DAY_INSIGHT.articles) break;
    let text: string | null = null;
    try {
      text = await read(item);
    } catch {
      text = null;
    }
    const trimmed = text?.replace(/\s+/g, " ").trim().slice(0, DAY_INSIGHT.articleChars) ?? "";
    if (trimmed.length === 0) {
      failed += 1;
      continue;
    }
    articles.push({ ...item, text: trimmed });
  }
  return { articles, failed };
}

const sameSession = (insight: DayInsight | null | undefined, session: Date) =>
  Boolean(insight) && insight!.session.getTime() === session.getTime();

/**
 * A cotação foi buscada a partir das 10:30 (São Paulo) do dia do pregão? Antes disso a brapi ainda
 * atrasa e a variação pode ser a do pregão anterior: o ativo espera uma cotação assentada.
 */
export function quoteSettled(quoteFetchedAt: Date, session: Date): boolean {
  const settleAt = saoPauloToUtc(
    session.getUTCFullYear(),
    session.getUTCMonth() + 1,
    session.getUTCDate(),
    Math.floor(DAY_INSIGHT.settleMinutes / 60),
    DAY_INSIGHT.settleMinutes % 60,
  );
  return quoteFetchedAt.getTime() >= settleAt.getTime();
}

/**
 * O ativo deve ser processado agora? (horário de São Paulo)
 * - no dia do pregão antes das 10:30: não, nem a primeira vez (a variação ainda é a do anterior);
 * - sem resumo deste pregão: sim;
 * - com resumo do dia: não, ele é definitivo;
 * - fora do dia do pregão (de noite depois das 20:00, no fim de semana): não;
 * - das 12:00 às 18:00 e a partir das 20:00: não;
 * - antes das 12:00 e das 18:00 às 20:00: sim, 30 min depois da última tentativa.
 */
export function nextInsightAttempt(
  insight: DayInsight | null | undefined,
  session: Date,
  now: Date,
): boolean {
  const parts = saoPauloParts(now);
  const onSessionDay = Date.UTC(parts.year, parts.month - 1, parts.day) === session.getTime();
  const minutes = parts.hour * 60 + parts.minute;
  if (onSessionDay && minutes < DAY_INSIGHT.settleMinutes) return false;
  if (!sameSession(insight, session)) return true;
  const current = insight!;
  if (current.sameDay) return false;
  if (!onSessionDay) return false;
  const morning = minutes < DAY_INSIGHT.morningUntilMinutes;
  const afterClose =
    minutes >= DAY_INSIGHT.afterCloseFromMinutes && minutes < DAY_INSIGHT.finalAtMinutes;
  if (!morning && !afterClose) return false;
  return now.getTime() - current.attemptedAt.getTime() >= DAY_INSIGHT.retryMinutes * 60_000;
}

export type InsightPlan =
  { mode: "day"; news: InsightNews[] } | { mode: "week"; news: InsightNews[] } | { mode: "none" };

/**
 * O que fazer agora. `previous` é o resumo deste movimento (`sameMovement`) ou null; um que falhou
 * conta como nenhum.
 * - há notícia do pregão e (não há resumo, ou ele é da semana, ou há notícia do pregão fora das
 *   fontes): resumo do dia;
 * - não há notícia do pregão nem resumo: resumo da semana (lista vazia grava "no-news" sem Gemini);
 * - senão: nada (a busca é grátis, a cota do Gemini não).
 */
export function insightPlan(
  previous: DayInsight | null | undefined,
  sessionNews: readonly InsightNews[],
  weekItems: readonly InsightNews[],
): InsightPlan {
  const current = previous && previous.status !== "failed" ? previous : null;
  if (sessionNews.length > 0) {
    if (!current || current.kind === "week") return { mode: "day", news: [...sessionNews] };
    const known = new Set(current.sources.map((source) => urlKey(source.url)));
    if (sessionNews.some((item) => !known.has(urlKey(item.url)))) {
      return { mode: "day", news: [...sessionNews] };
    }
    return { mode: "none" };
  }
  if (!current) return { mode: "week", news: [...weekItems] };
  return { mode: "none" };
}

/** O índice de comparação da classe: IFIX para FII, Ibovespa para ação (e sem classe). */
export const marketIndexFor = (assetClass: AssetClass | null): MarketIndexId =>
  assetClass === "FII" ? "IFIX" : "IBOV";

const roundFraction = (value: number) => Math.round(value * 1e9) / 1e9;

/**
 * O ativo acompanhou o mercado: mesmo sinal e |ativo − índice| < max(1 p.p., metade do índice).
 * Senão (inclusive sinais opostos e índice parado), descolou.
 */
export function marketReading(assetChange: number, indexChange: number): MarketReadingKind {
  if (Math.sign(assetChange) !== Math.sign(indexChange)) return "descolou";
  const gap = roundFraction(Math.abs(assetChange - indexChange));
  const limit = roundFraction(Math.max(0.01, 0.5 * Math.abs(indexChange)));
  return gap < limit ? "acompanhou" : "descolou";
}

/** A leitura contra o índice da classe, só quando o índice é do mesmo pregão do resumo. */
export function insightMarket(
  assetClass: AssetClass | null,
  assetChange: number,
  indices: ReadonlyMap<MarketIndexId, { changePercent: number; session: Date }>,
  session: Date,
): MarketReading | null {
  const index = marketIndexFor(assetClass);
  const value = indices.get(index);
  if (!value || value.session.getTime() !== session.getTime()) return null;
  if (!Number.isFinite(value.changePercent)) return null;
  return {
    index,
    indexChange: value.changePercent,
    reading: marketReading(assetChange, value.changePercent),
  };
}

const INDEX_NAMES: Record<MarketIndexId, string> = { IFIX: "IFIX", IBOV: "Ibovespa" };

const formatPercent = (fraction: number) =>
  `${Math.abs(fraction * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;

const movement = (fraction: number) =>
  Math.abs(fraction) < DAY_INSIGHT.stableBelow
    ? "ficou estável"
    : `${fraction > 0 ? "subiu" : "caiu"} ${formatPercent(fraction)}`;

/** "O IFIX subiu 0,82% neste pregão e o TRXF11 subiu 1,73%, acompanhando o mercado." */
export function marketReadingText(
  ticker: string,
  assetChange: number,
  market: MarketReading,
): string {
  const ending =
    market.reading === "acompanhou" ? "acompanhando o mercado" : "bem diferente do mercado";
  return `O ${INDEX_NAMES[market.index]} ${movement(market.indexChange)} neste pregão e o ${ticker} ${movement(assetChange)}, ${ending}.`;
}

/** Um candidato ao resumo: posição aberta (quantidade) ou ativo da Carteira Alvo (rank). */
export type InsightCandidate = {
  ticker: string;
  /** Cotas na carteira; 0 ou null quando só está na Carteira Alvo. */
  quantity: number | null;
  rank: number | null;
};

/**
 * A ordem de prioridade na cota do Gemini: as posições abertas por valor (cotas × preço), depois
 * os ativos só da Carteira Alvo por rank (sem rank por último). Empates pelo ticker.
 */
export function prioritizeInsights<T extends InsightCandidate>(
  candidates: readonly T[],
  priceOf: (ticker: string) => number | null,
): T[] {
  const value = (item: T) => (item.quantity ?? 0) * (priceOf(item.ticker) ?? 0);
  const held = (item: T) => (item.quantity ?? 0) > 0;
  return [...candidates].sort((a, b) => {
    if (held(a) !== held(b)) return held(a) ? -1 : 1;
    if (held(a)) return value(b) - value(a) || a.ticker.localeCompare(b.ticker);
    const rankA = a.rank ?? Number.POSITIVE_INFINITY;
    const rankB = b.rank ?? Number.POSITIVE_INFINITY;
    return rankA - rankB || a.ticker.localeCompare(b.ticker);
  });
}

const formatSigned = (fraction: number) =>
  `${fraction > 0 ? "+" : ""}${(fraction * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;

const formatDay = (date: Date) => {
  const { day, month, year, hour, minute } = saoPauloParts(date);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(day)}/${pad(month)}/${year} ${pad(hour)}:${pad(minute)}`;
};

const assetKind = (assetClass: AssetClass | null) =>
  assetClass === "FII" ? "um fundo imobiliário (FII)" : "uma ação";

const marketLine = (ticker: string, change: number, market: MarketReading | null | undefined) =>
  market ? [marketReadingText(ticker, change, market)] : [];

/**
 * O prompt do resumo do dia, em pt-BR, só com dados públicos: o ticker, a classe, a variação do
 * dia, a leitura contra o índice e as notícias do pregão. Nunca leva quantidade, preço médio ou
 * valor da carteira.
 */
export function buildInsightPrompt(input: {
  ticker: string;
  assetClass: AssetClass | null;
  changePercent: number;
  session: Date;
  articles: readonly NewsArticle[];
  market?: MarketReading | null;
}): string {
  const sessionDay = formatDay(input.session).slice(0, 10);
  const news = input.articles
    .map(
      (article, index) =>
        `Notícia ${index + 1}: "${article.title}" (${article.publisher}, ${formatDay(article.publishedAt)})\n${article.text}`,
    )
    .join("\n\n");
  return [
    `${input.ticker} é ${assetKind(input.assetClass)} negociado na bolsa brasileira. No pregão de ${sessionDay}, a cotação variou ${formatSigned(input.changePercent)}, um movimento fora do comum.`,
    ...marketLine(input.ticker, input.changePercent, input.market),
    "",
    "Notícias do pregão sobre o ativo:",
    "",
    news,
    "",
    "Tarefa:",
    "- Use só as notícias acima, todas publicadas desde o fechamento do pregão anterior. Se elas não explicarem o movimento, diga isso; não invente causas.",
    "- Explique, para quem não entende de mercado financeiro, o que as notícias dizem sobre esse movimento.",
    "- Escreva um único parágrafo, com no máximo 4 frases curtas, em português do Brasil.",
    "- Evite jargões; se um termo técnico for inevitável, explique-o em poucas palavras.",
    "- Se as notícias trouxerem um fato que explica a variação, diga qual é.",
    !input.market || input.market.reading === "acompanhou"
      ? "- Se não trouxerem, diga que as notícias não explicam o movimento e que ele pode refletir o humor geral do mercado."
      : "- Se não trouxerem, diga apenas que as notícias não explicam o movimento.",
    "- Não recomende comprar, vender ou manter o ativo.",
    "- Responda só com o parágrafo, sem título e sem listar as fontes.",
  ].join("\n");
}

/**
 * O prompt do resumo da semana: sem notícia do pregão, o que aconteceu com o ativo nos últimos
 * dias, só com título, portal, data e resumo de cada notícia (sem ler páginas). Nunca diz que as
 * notícias explicam a variação de hoje. Sem dados da carteira.
 */
export function buildWeekPrompt(input: {
  ticker: string;
  assetClass: AssetClass | null;
  changePercent: number;
  session: Date;
  items: readonly (NewsItem & { description: string | null })[];
  market?: MarketReading | null;
}): string {
  const sessionDay = formatDay(input.session).slice(0, 10);
  const news = input.items
    .map((item) => {
      const head = `"${item.title}" (${item.publisher}, ${formatDay(item.publishedAt).slice(0, 5)})`;
      return item.description ? `${head} — ${item.description}` : head;
    })
    .join("\n");
  return [
    `${input.ticker} é ${assetKind(input.assetClass)} negociado na bolsa brasileira. No pregão de ${sessionDay}, a cotação variou ${formatSigned(input.changePercent)}.`,
    ...marketLine(input.ticker, input.changePercent, input.market),
    "",
    `Escreva um parágrafo de até 4 frases curtas, para leigos, resumindo o que aconteceu com ${input.ticker} nesta semana segundo as notícias abaixo (cada uma com a data). Não diga que essas notícias explicam a variação de hoje: nenhuma é do pregão de hoje. Não recomende comprar, vender ou manter. Responda só com o parágrafo.`,
    "",
    "Notícias da semana sobre o ativo:",
    "",
    news,
  ].join("\n");
}
