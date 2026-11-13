import { saoPauloParts } from "@/shared/lib/time";
import type { AssetClass } from "./asset-class";

// Resumo da IA para variações fortes do dia (spec 2026-11-12-resumo-ia-variacao-design.md).
// Regras puras: gatilho, leitura do RSS do Bing, horários das novas tentativas e o prompt. Só
// dados públicos entram aqui: nenhum dado de carteira chega ao Gemini.

export const DAY_INSIGHT = {
  /** |variação do dia| (fração) que dispara o resumo, por classe. O limite exato dispara. */
  threshold: { FII: 0.02, ACAO: 0.03 } satisfies Record<AssetClass, number>,
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

export type DayInsightStatus = "ok" | "no-news" | "failed";

/** O resumo guardado no ativo: um por pregão. */
export type DayInsight = {
  /** O pregão (data de negócio) da variação. */
  session: Date;
  changePercent: number;
  /** "ok": texto do Gemini; "no-news": nenhuma notícia lida; "failed": o Gemini falhou. */
  status: DayInsightStatus;
  text: string | null;
  /** Alguma fonte usada é notícia do dia do pregão. */
  sameDay: boolean;
  sources: NewsItem[];
  model: string | null;
  generatedAt: Date | null;
  attemptedAt: Date;
};

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

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
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

const tag = (item: string, name: string): string | null => {
  const match = item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  if (!match) return null;
  const raw = match[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1");
  return decodeEntities(raw).trim();
};

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
    const title = tag(body, "title");
    const link = tag(body, "link");
    const date = tag(body, "pubDate");
    const url = link ? portalUrl(link) : null;
    const publishedAt = date ? new Date(date) : null;
    if (!title || !url || !publishedAt || Number.isNaN(publishedAt.getTime())) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    const publisher = tag(body, "News:Source") ?? new URL(url).hostname.replace(/^www\./, "");
    items.push({ title, publisher, url, publishedAt });
  }
  return items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

/** Só as notícias de até `maxNewsAgeDays` antes de `now`. */
export function recentNews(items: readonly NewsItem[], now: Date): NewsItem[] {
  const from = now.getTime() - DAY_INSIGHT.maxNewsAgeDays * 86_400_000;
  return items.filter((item) => item.publishedAt.getTime() >= from);
}

/** A notícia foi publicada, no horário de São Paulo, no dia do pregão (meia-noite UTC). */
export function isSameDay(publishedAt: Date, session: Date): boolean {
  const { year, month, day } = saoPauloParts(publishedAt);
  return Date.UTC(year, month - 1, day) === session.getTime();
}

/**
 * Lê as notícias na ordem dada até conseguir `DAY_INSIGHT.articles`: uma que falha (rede, status,
 * sem texto) é pulada e entra a próxima. Uma de cada vez, porque os sites são de terceiros.
 */
export async function readFirstArticles(
  items: readonly NewsItem[],
  read: (item: NewsItem) => Promise<string | null>,
): Promise<{ articles: NewsArticle[]; failed: number }> {
  const articles: NewsArticle[] = [];
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
 * O ativo deve ser processado agora? (horário de São Paulo)
 * - sem resumo deste pregão: sim;
 * - com notícia do dia: não, o resumo é definitivo;
 * - fora do dia do pregão (de noite depois das 20:00, no fim de semana): não;
 * - das 12:00 às 18:00 e a partir das 20:00: não;
 * - antes das 12:00 e das 18:00 às 20:00: sim, 30 min depois da última tentativa.
 */
export function nextInsightAttempt(
  insight: DayInsight | null | undefined,
  session: Date,
  now: Date,
): boolean {
  if (!sameSession(insight, session)) return true;
  const current = insight!;
  if (current.sameDay) return false;
  const parts = saoPauloParts(now);
  if (Date.UTC(parts.year, parts.month - 1, parts.day) !== session.getTime()) return false;
  const minutes = parts.hour * 60 + parts.minute;
  const morning = minutes < DAY_INSIGHT.morningUntilMinutes;
  const afterClose =
    minutes >= DAY_INSIGHT.afterCloseFromMinutes && minutes < DAY_INSIGHT.finalAtMinutes;
  if (!morning && !afterClose) return false;
  return now.getTime() - current.attemptedAt.getTime() >= DAY_INSIGHT.retryMinutes * 60_000;
}

/**
 * Vale chamar o Gemini com estas notícias? Sem resumo bom deste pregão, sim (havendo notícia).
 * Com um, só quando aparece uma notícia do dia que não está entre as fontes salvas: a busca no
 * Bing é grátis, a cota do Gemini não.
 */
export function shouldCallGemini(
  insight: DayInsight | null | undefined,
  news: readonly NewsItem[],
  session: Date,
): boolean {
  if (news.length === 0) return false;
  if (!sameSession(insight, session) || insight!.status !== "ok") return true;
  const known = new Set(insight!.sources.map((source) => source.url));
  return news.some((item) => isSameDay(item.publishedAt, session) && !known.has(item.url));
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

/**
 * O prompt do Gemini, em pt-BR, só com dados públicos: o ticker, a classe, a variação do dia e as
 * notícias. Nunca leva quantidade, preço médio ou valor da carteira.
 */
export function buildInsightPrompt(input: {
  ticker: string;
  assetClass: AssetClass | null;
  changePercent: number;
  session: Date;
  articles: readonly NewsArticle[];
}): string {
  const kind = input.assetClass === "FII" ? "um fundo imobiliário (FII)" : "uma ação";
  const sessionDay = formatDay(input.session).slice(0, 10);
  const news = input.articles
    .map(
      (article, index) =>
        `Notícia ${index + 1}: "${article.title}" (${article.publisher}, ${formatDay(article.publishedAt)})\n${article.text}`,
    )
    .join("\n\n");
  return [
    `${input.ticker} é ${kind} negociado na bolsa brasileira. No pregão de ${sessionDay}, a cotação variou ${formatSigned(input.changePercent)}, um movimento fora do comum.`,
    "",
    "Notícias recentes sobre o ativo:",
    "",
    news,
    "",
    "Tarefa:",
    "- Explique, para quem não entende de mercado financeiro, o que as notícias dizem sobre esse movimento.",
    "- Escreva um único parágrafo, com no máximo 4 frases curtas, em português do Brasil.",
    "- Evite jargões; se um termo técnico for inevitável, explique-o em poucas palavras.",
    "- Se as notícias trouxerem um fato que explica a variação, diga qual é.",
    "- Se não trouxerem, diga que as notícias não explicam o movimento e que ele pode refletir o humor geral do mercado. Não invente causas.",
    "- Não recomende comprar, vender ou manter o ativo.",
    "- Responda só com o parágrafo, sem título e sem listar as fontes.",
  ].join("\n");
}
