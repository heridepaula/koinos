# Coletor de notícias e índices (etapa 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guardar as notícias da semana de cada ativo e do cenário (feeds RSS de Suno, fiis.com.br, InfoMoney e Money Times) e a variação do dia do Ibovespa e do IFIX, base das etapas seguintes (triagem, cenário, "por que subiu ou caiu").

**Architecture:** Etapa 2 do spec `docs/superpowers/specs/2026-11-13-noticias-e-cenario-design.md` (Camada 2). Regras puras em `market-data/domain/news.ts` (parser de RSS, URL normalizada, ligação notícia → ticker, fontes, rodízio dos feeds por empresa) e `market-data/domain/market-indices.ts`; I/O em `adapters/news.ts` (`fetchFeed`) e `adapters/yahoo.ts` (`getIndexQuotes`); serviços `server/news-service.ts` e `server/market-indices-service.ts`; rota `/api/cron/news` chamada pelo cron-job.org. Nenhuma IA nesta etapa; nada é mostrado na tela ainda.

**Tech Stack:** TypeScript, Vitest, Next 16 route handlers, Mongoose, yahoo-finance2.

**Antes de começar:** `git switch main && git pull --ff-only && git switch -c feat/coletor-noticias`. Comentários em pt-BR; commits em inglês com `-m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`. Nunca rodar script contra o banco: o `MONGODB_URI` do `.env.local` é produção.

**Testado em 2026-11-13** (o plano conta com isso):

- Feeds com 10 itens cada: `suno.com.br/noticias/feed/`, `fiis.com.br/noticias/feed/`, `infomoney.com.br/feed/`, `moneytimes.com.br/feed/`, `moneytimes.com.br/category/politica/feed/`.
- `infomoney.com.br/tudo-sobre/<slug>/feed/`: 200 para `petrobras`, `vale`, `banco-do-brasil`, `bb-seguridade`, `itausa`, `engie-brasil`, `axia`, `unipar`, `slc-agricola`, `brasilagro`, `tupy`; 404 para `ser-educacional` (SEER3 fica sem feed por empresa).
- Yahoo `quote(["^BVSP", "IFIX.SA"])`: `regularMarketPrice`, `regularMarketPreviousClose`, `regularMarketChangePercent` (em %) e `regularMarketTime` (Date) nos dois.

**Desvios do spec, decididos aqui:**

- Spans: a rota abre `cron.news`; os atributos `koinos.news.*` ficam no span `news.collect` do serviço, e os índices no `market.indices`.
- Notícia de feed só de ativos (Suno, fiis.com.br) sem ticker acompanhado não é guardada: não serve nem ao ativo nem ao cenário.
- O Bing por ticker e os termos fixos do cenário entram nas etapas da triagem e do cenário, não aqui.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/features/market-data/domain/news.ts` (novo) | `NEWS`, `decodeEntities`, `rssTag`, `parseRssFeed`, `cleanDescription`, `normalizeNewsUrl`, `NEWS_SOURCES`, `COMPANY_FEED_SOURCE`, `INFOMONEY_SLUGS`, `NEWS_ALIASES`, `matchTickers`, `newsItemFromFeed`, `companyFeedsDue`. Puro. |
| `src/features/market-data/domain/news.test.ts` (novo) | Testes. |
| `src/features/market-data/domain/day-insight.ts` | Passa a importar `decodeEntities`/`rssTag` de `./news`. |
| `src/features/market-data/domain/market-indices.ts` (novo) | `MARKET_INDICES`, `marketIndexFromQuote`. Puro. |
| `src/features/market-data/domain/market-indices.test.ts` (novo) | Testes. |
| `src/features/market-data/adapters/news.ts` | `fetchFeed`. |
| `src/features/market-data/adapters/yahoo.ts` | `getIndexQuotes`. |
| `src/features/market-data/server/models.ts` | `NewsItemModel`, `NewsFeedModel`, `MarketIndexModel`. |
| `src/features/market-data/server/news-service.ts` (novo) | `collectNews`, `newsIdOf`. |
| `src/features/market-data/server/market-indices-service.ts` (novo) | `refreshMarketIndices`. |
| `src/features/market-data/server.ts` | Exporta os dois serviços. |
| `src/app/api/cron/news/route.ts` (novo) | Rota do cron. |
| `CLAUDE.md`, `docs/operations/cron-job-org.md`, spec | Documentação. |

---

### Task 1: RSS puro (`domain/news.ts`, parte 1)

**Goal:** Ler um feed RSS genérico (WordPress) em itens limpos: título, URL normalizada, data e resumo sem HTML.

**Files:**
- Create: `src/features/market-data/domain/news.ts`
- Create: `src/features/market-data/domain/news.test.ts`
- Modify: `src/features/market-data/domain/day-insight.ts:118-149` (mover `ENTITIES`, `decodeEntities` e `tag` para `news.ts`)

**Acceptance Criteria:**
- [ ] `parseRssFeed` lê `<item>` com título, `<link>` (ou `<guid>`), `<pubDate>` e `<description>`, com CDATA e entidades (`&#8216;`, `&amp;`); pula item sem título, sem URL http(s) ou sem data válida; tira URLs repetidas; ordena do mais novo ao mais velho.
- [ ] `cleanDescription` tira HTML, o rodapé "The post … appeared first on …"/"O post … apareceu primeiro em …", junta espaços e corta em 400 caracteres numa palavra, com "…".
- [ ] `normalizeNewsUrl` tira `utm_*` e o fragmento; recusa o que não é http(s).
- [ ] `parseBingNews` continua passando nos testes atuais de `day-insight.test.ts`.

**Verify:** `npx vitest run src/features/market-data/domain/news.test.ts src/features/market-data/domain/day-insight.test.ts` → PASS.

**Steps:**

- [ ] **Step 1: Teste**

```ts
// src/features/market-data/domain/news.test.ts
import { describe, expect, it } from "vitest";
import { cleanDescription, normalizeNewsUrl, parseRssFeed } from "./news";

const item = (body: string) => `<item>${body}</item>`;
const feed = (...items: string[]) => `<?xml version="1.0"?><rss><channel><link>https://site</link>${items.join("")}</channel></rss>`;

describe("parseRssFeed", () => {
  it("lê título, link, data e resumo, com CDATA e entidades", () => {
    const [first] = parseRssFeed(
      feed(
        item(
          "<title><![CDATA[Petrobras (PETR4) anuncia &#8216;dividendos&#8217; &amp; JCP]]></title>" +
            "<link>https://www.infomoney.com.br/x/?utm_source=rss#top</link>" +
            "<pubDate>Fri, 13 Nov 2026 13:41:19 +0000</pubDate>" +
            "<description><![CDATA[<p>Resumo <b>curto</b>.</p><p>The post Título appeared first on InfoMoney.</p>]]></description>",
        ),
      ),
    );
    expect(first).toEqual({
      title: "Petrobras (PETR4) anuncia ‘dividendos’ & JCP",
      url: "https://www.infomoney.com.br/x/",
      publishedAt: new Date("2026-11-13T13:41:19Z"),
      description: "Resumo curto .",
    });
  });

  it("usa o guid sem link; pula item inválido e URL repetida; ordena do mais novo", () => {
    const items = parseRssFeed(
      feed(
        item("<title>A</title><guid>https://a.com/1</guid><pubDate>Thu, 12 Nov 2026 10:00:00 +0000</pubDate>"),
        item("<title>B</title><link>https://a.com/2</link><pubDate>Fri, 13 Nov 2026 10:00:00 +0000</pubDate>"),
        item("<title>C</title><link>https://a.com/2</link><pubDate>Fri, 13 Nov 2026 11:00:00 +0000</pubDate>"),
        item("<title></title><link>https://a.com/3</link><pubDate>Fri, 13 Nov 2026 10:00:00 +0000</pubDate>"),
        item("<title>D</title><link>ftp://a.com/4</link><pubDate>Fri, 13 Nov 2026 10:00:00 +0000</pubDate>"),
        item("<title>E</title><link>https://a.com/5</link><pubDate>ontem</pubDate>"),
      ),
    );
    expect(items.map((i) => i.title)).toEqual(["B", "A"]);
    expect(items[1].description).toBeNull();
  });
});

describe("cleanDescription", () => {
  it("tira HTML, rodapé em pt e junta espaços", () => {
    expect(cleanDescription("<p>Um   texto</p>\n<p>O post X apareceu primeiro em Money Times.</p>")).toBe("Um texto");
  });

  it("vazio vira null", () => {
    expect(cleanDescription(null)).toBeNull();
    expect(cleanDescription("<p> </p>")).toBeNull();
  });

  it("corta em 400 caracteres numa palavra", () => {
    const text = cleanDescription(`${"palavra ".repeat(80)}fim`);
    expect(text!.length).toBeLessThanOrEqual(401);
    expect(text!.endsWith("palavra…")).toBe(true);
  });
});

describe("normalizeNewsUrl", () => {
  it("tira utm e fragmento, mantém o resto", () => {
    expect(normalizeNewsUrl("https://Site.com/a?id=1&utm_medium=x#c")).toBe("https://site.com/a?id=1");
  });

  it("recusa o que não é http(s) ou não é URL", () => {
    expect(normalizeNewsUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeNewsUrl("nada")).toBeNull();
  });
});
```

- [ ] **Step 2: Ver falhar**

Run: `npx vitest run src/features/market-data/domain/news.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

Criar `news.ts` com o bloco abaixo e **mover** de `day-insight.ts` as constantes `ENTITIES`, a função `decodeEntities` e a `tag` (renomeada `rssTag`, exportada). Em `day-insight.ts`, importar `import { rssTag } from "./news";` e trocar as chamadas de `tag(` por `rssTag(` em `parseBingNews`.

```ts
// src/features/market-data/domain/news.ts

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

const WORDPRESS_FOOTER = /\s*(The post|O post)\s[\s\S]*?(appeared first on|apareceu primeiro em)[\s\S]*$/i;

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
    const title = rssTag(body, "title")?.replace(/<[^>]*>/g, "").trim();
    const link = rssTag(body, "link") || rssTag(body, "guid");
    const date = rssTag(body, "pubDate");
    const url = link ? normalizeNewsUrl(link) : null;
    const publishedAt = date ? new Date(date) : null;
    if (!title || !url || !publishedAt || Number.isNaN(publishedAt.getTime())) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    items.push({ title, url, publishedAt, description: cleanDescription(rssTag(body, "description")) });
  }
  return items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
```

O primeiro teste espera `"Resumo curto ."`: o HTML vira espaços, então sobra um espaço antes do ponto. É o comportamento aceito (o resumo é só para a triagem); não "conserte" com regra de pontuação.

- [ ] **Step 4: Ver passar**

Run: `npx vitest run src/features/market-data/domain/news.test.ts src/features/market-data/domain/day-insight.test.ts` → PASS. `npm run format`.

- [ ] **Step 5: Commit**

```bash
git add src/features/market-data/domain/news.ts src/features/market-data/domain/news.test.ts src/features/market-data/domain/day-insight.ts
git commit -m "feat(market-data): generic RSS parser for news feeds" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Fontes e ligação notícia → ativo (`domain/news.ts`, parte 2)

**Goal:** As fontes testadas, os feeds por empresa, a ligação de cada notícia aos tickers acompanhados e o rodízio dos feeds por empresa, puros.

**Files:**
- Modify: `src/features/market-data/domain/news.ts`
- Modify: `src/features/market-data/domain/news.test.ts`

**Acceptance Criteria:**
- [ ] `matchTickers` acha o ticker exato (maiúsculo, palavra inteira), a família (PETR3 casa com o acompanhado PETR4) e os apelidos de `NEWS_ALIASES` com caixa exata e palavra inteira ("vale a pena" não casa com VALE3); devolve ordenado e sem repetição.
- [ ] `newsItemFromFeed` dá os tópicos (`ativo` só com ticker e fonte de ativo; `cenario` quando a fonte é de cenário), recusa item sem tópico, com mais de 14 dias ou mais de 1 h no futuro, e acrescenta o ticker do feed por empresa.
- [ ] `companyFeedsDue` devolve os feeds nunca lidos ou lidos há 2 h ou mais, os mais antigos primeiro, no máximo 4.

**Verify:** `npx vitest run src/features/market-data/domain/news.test.ts` → PASS.

**Steps:**

- [ ] **Step 1: Teste (acrescentar a `news.test.ts`)**

```ts
import {
  COMPANY_FEED_SOURCE,
  companyFeedsDue,
  matchTickers,
  NEWS_SOURCES,
  newsItemFromFeed,
  type FeedItem,
} from "./news";

const tracked = ["PETR4", "VALE3", "HGLG11", "BBAS3"];

describe("matchTickers", () => {
  it("ticker exato, palavra inteira", () => {
    expect(matchTickers("HGLG11 paga rendimento; XHGLG11 não", tracked)).toEqual(["HGLG11"]);
    expect(matchTickers("hglg11 em minúsculas não conta", tracked)).toEqual([]);
  });

  it("família: PETR3 liga à PETR4 acompanhada", () => {
    expect(matchTickers("PETR3 sobe", tracked)).toEqual(["PETR4"]);
  });

  it("apelidos com caixa exata e palavra inteira", () => {
    expect(matchTickers("A Petrobras anunciou", tracked)).toEqual(["PETR4"]);
    expect(matchTickers("Vale a pena investir?", tracked)).toEqual([]);
    expect(matchTickers("A mineradora Vale e o Banco do Brasil", tracked)).toEqual(["BBAS3", "VALE3"]);
    expect(matchTickers("A Petrobras não é acompanhada", ["VALE3"])).toEqual([]);
  });
});

describe("newsItemFromFeed", () => {
  const now = new Date("2026-11-13T15:00:00Z");
  const feedItem = (over: Partial<FeedItem> = {}): FeedItem => ({
    title: "HGLG11 aluga galpão",
    url: "https://fiis.com.br/n/1",
    publishedAt: new Date("2026-11-13T12:00:00Z"),
    description: null,
    ...over,
  });
  const source = (id: string) => NEWS_SOURCES.find((s) => s.id === id)!;

  it("fonte de ativo: só com ticker", () => {
    expect(newsItemFromFeed(feedItem(), source("fiis"), tracked, now)).toMatchObject({
      tickers: ["HGLG11"],
      topics: ["ativo"],
      publisher: "FIIs.com.br",
      source: "fiis",
      readPage: true,
    });
    expect(newsItemFromFeed(feedItem({ title: "Mercado sobe" }), source("fiis"), tracked, now)).toBeNull();
  });

  it("fonte de cenário: guarda sem ticker; com ticker, os dois tópicos", () => {
    expect(newsItemFromFeed(feedItem({ title: "Senado aprova pacote" }), source("moneytimes-politica"), tracked, now)).toMatchObject({ tickers: [], topics: ["cenario"] });
    expect(newsItemFromFeed(feedItem(), source("infomoney"), tracked, now)?.topics).toEqual(["ativo", "cenario"]);
  });

  it("a Suno não tem a página lida", () => {
    expect(newsItemFromFeed(feedItem(), source("suno"), tracked, now)?.readPage).toBe(false);
  });

  it("idade: até 14 dias e no máximo 1 h no futuro", () => {
    const day = 86_400_000;
    expect(newsItemFromFeed(feedItem({ publishedAt: new Date(now.getTime() - 15 * day) }), source("fiis"), tracked, now)).toBeNull();
    expect(newsItemFromFeed(feedItem({ publishedAt: new Date(now.getTime() + 2 * 3_600_000) }), source("fiis"), tracked, now)).toBeNull();
  });

  it("feed por empresa acrescenta o ticker do feed", () => {
    const item = newsItemFromFeed(feedItem({ title: "Estatal muda diretoria" }), COMPANY_FEED_SOURCE, tracked, now, "PETR4");
    expect(item).toMatchObject({ tickers: ["PETR4"], topics: ["ativo"], source: "infomoney-empresa" });
  });
});

describe("companyFeedsDue", () => {
  const now = new Date("2026-11-13T15:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
  const feeds = ["A", "B", "C", "D", "E", "F"].map((t) => ({ ticker: t, url: `u/${t}` }));

  it("nunca lidos primeiro, depois os mais antigos; respeita 2 h e o máximo de 4", () => {
    const last = new Map([
      ["u/A", hoursAgo(1)],
      ["u/B", hoursAgo(5)],
      ["u/C", hoursAgo(3)],
      ["u/D", hoursAgo(2)],
    ]);
    expect(companyFeedsDue(feeds, last, now).map((f) => f.ticker)).toEqual(["E", "F", "B", "C"]);
  });
});
```

- [ ] **Step 2: Ver falhar** — `npx vitest run src/features/market-data/domain/news.test.ts` → FAIL.

- [ ] **Step 3: Implementar (acrescentar a `news.ts`)**

```ts
export type NewsTopic = "ativo" | "cenario";
export type NewsSourceId =
  | "suno"
  | "fiis"
  | "infomoney"
  | "infomoney-empresa"
  | "moneytimes"
  | "moneytimes-politica";

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
  { id: "suno", url: "https://www.suno.com.br/noticias/feed/", publisher: "Suno", topics: ["ativo"], readPage: false },
  { id: "fiis", url: "https://fiis.com.br/noticias/feed/", publisher: "FIIs.com.br", topics: ["ativo"], readPage: true },
  { id: "infomoney", url: "https://www.infomoney.com.br/feed/", publisher: "InfoMoney", topics: ["ativo", "cenario"], readPage: true },
  { id: "moneytimes", url: "https://www.moneytimes.com.br/feed/", publisher: "Money Times", topics: ["ativo", "cenario"], readPage: true },
  { id: "moneytimes-politica", url: "https://www.moneytimes.com.br/category/politica/feed/", publisher: "Money Times", topics: ["cenario"], readPage: true },
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
      const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(alias)}(?![\\p{L}\\p{N}])`, "u");
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
```

No teste de `companyFeedsDue`, D foi lido há exatamente 2 h e entra (`<= limit`), mas fica fora pelo máximo de 4: E e F (nunca lidos), B (5 h), C (3 h). O `sort` é estável, então E vem antes de F.

- [ ] **Step 4: Ver passar** — mesmo comando → PASS. `npm run format`.

- [ ] **Step 5: Commit**

```bash
git add src/features/market-data/domain/news.ts src/features/market-data/domain/news.test.ts
git commit -m "feat(market-data): news sources and ticker matching" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Índices de mercado (Ibovespa e IFIX)

**Goal:** Guardar a variação do pregão do Ibovespa e do IFIX, lida do Yahoo pelo mesmo cliente das cotações, só quando a última leitura venceu (a mesma regra das cotações).

**Files:**
- Create: `src/features/market-data/domain/market-indices.ts`
- Create: `src/features/market-data/domain/market-indices.test.ts`
- Modify: `src/features/market-data/adapters/yahoo.ts`
- Modify: `src/features/market-data/server/models.ts`
- Create: `src/features/market-data/server/market-indices-service.ts`

**Acceptance Criteria:**
- [ ] `marketIndexFromQuote` usa a variação do Yahoo (fração) ou, sem ela, preço ÷ fechamento anterior − 1; recusa preço ausente ou ≤ 0; o pregão vem de `quoteSessionDate(regularMarketTime ?? now)`.
- [ ] `getIndexQuotes` lê `^BVSP` e `IFIX.SA` numa chamada `quote` do cliente com fila (`YAHOO_CONCURRENCY`).
- [ ] `refreshMarketIndices` só busca os índices vencidos (`isQuoteStale`), grava em `market_indices` e nunca lança: falha vira `status: "error"`.
- [ ] Testes, typecheck e lint passam.

**Verify:** `npx vitest run src/features/market-data/domain/market-indices.test.ts && npm run typecheck && npx eslint src/features/market-data` → sem erros.

**Steps:**

- [ ] **Step 1: Teste**

```ts
// src/features/market-data/domain/market-indices.test.ts
import { describe, expect, it } from "vitest";
import { quoteSessionDate } from "./market-hours";
import { MARKET_INDICES, marketIndexFromQuote } from "./market-indices";

const now = new Date("2026-11-13T15:00:00Z");

describe("marketIndexFromQuote", () => {
  it("usa a variação do Yahoo e o pregão do horário da cotação", () => {
    const time = new Date("2026-11-13T14:21:00Z");
    expect(
      marketIndexFromQuote({ price: 3594.1, previousClose: 3566.57, changePercent: 0.0077, time }, now),
    ).toEqual({ price: 3594.1, previousClose: 3566.57, changePercent: 0.0077, session: quoteSessionDate(time) });
  });

  it("sem variação, calcula pelo fechamento anterior; sem horário, usa agora", () => {
    const value = marketIndexFromQuote({ price: 110, previousClose: 100, changePercent: null, time: null }, now);
    expect(value?.changePercent).toBeCloseTo(0.1);
    expect(value?.session).toEqual(quoteSessionDate(now));
  });

  it.each([
    { price: null, previousClose: 100, changePercent: 0.01, time: null },
    { price: 0, previousClose: 100, changePercent: 0.01, time: null },
    { price: 100, previousClose: null, changePercent: null, time: null },
  ])("recusa %j", (quote) => {
    expect(marketIndexFromQuote(quote, now)).toBeNull();
  });

  it("os dois índices e seus símbolos no Yahoo", () => {
    expect(MARKET_INDICES.map((i) => `${i.id}=${i.symbol}`)).toEqual(["IBOV=^BVSP", "IFIX=IFIX.SA"]);
  });
});
```

- [ ] **Step 2: Ver falhar** — `npx vitest run src/features/market-data/domain/market-indices.test.ts` → FAIL.

- [ ] **Step 3: Domínio**

```ts
// src/features/market-data/domain/market-indices.ts
import { quoteSessionDate } from "./market-hours";

// Índices do mercado para comparar a variação de um ativo com a do mercado no mesmo pregão
// (spec 2026-11-13-noticias-e-cenario-design.md). Testado em 2026-11-13: o Yahoo traz `^BVSP`
// e `IFIX.SA` (este só com o preço atual e o fechamento anterior). Puro.

export const MARKET_INDICES = [
  { id: "IBOV", symbol: "^BVSP" },
  { id: "IFIX", symbol: "IFIX.SA" },
] as const;

export type MarketIndexId = (typeof MARKET_INDICES)[number]["id"];

export type IndexQuote = {
  price: number | null;
  previousClose: number | null;
  /** Fração (0,0077 = 0,77%). */
  changePercent: number | null;
  time: Date | null;
};

export type MarketIndexValue = {
  price: number;
  previousClose: number | null;
  changePercent: number;
  /** O pregão da cotação (meia-noite UTC do dia em São Paulo). */
  session: Date;
};

export function marketIndexFromQuote(quote: IndexQuote, now: Date): MarketIndexValue | null {
  if (quote.price === null || !(quote.price > 0)) return null;
  const change =
    quote.changePercent ??
    (quote.previousClose !== null && quote.previousClose > 0
      ? quote.price / quote.previousClose - 1
      : null);
  if (change === null || !Number.isFinite(change)) return null;
  return {
    price: quote.price,
    previousClose: quote.previousClose,
    changePercent: change,
    session: quoteSessionDate(quote.time ?? now),
  };
}
```

- [ ] **Step 4: Adapter, modelo e serviço**

Em `adapters/yahoo.ts`, depois de `yahooProvider`:

```ts
import type { IndexQuote } from "../domain/market-indices";

const asNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const asDate = (value: unknown) =>
  value instanceof Date
    ? value
    : typeof value === "number"
      ? new Date(value * 1000)
      : typeof value === "string"
        ? new Date(value)
        : null;

/** Cotação de índices (símbolos do Yahoo, como `^BVSP`), numa chamada só. */
export async function getIndexQuotes(symbols: readonly string[]): Promise<Map<string, IndexQuote>> {
  const quotes = new Map<string, IndexQuote>();
  if (symbols.length === 0) return quotes;
  const results = await client().quote([...symbols], { return: "array" }, { validateResult: false });
  for (const result of results) {
    const percent = asNumber(result.regularMarketChangePercent);
    quotes.set(result.symbol, {
      price: asNumber(result.regularMarketPrice),
      previousClose: asNumber(result.regularMarketPreviousClose),
      changePercent: percent === null ? null : percent / 100,
      time: asDate(result.regularMarketTime),
    });
  }
  return quotes;
}
```

(o `import type` vai junto dos outros imports do topo do arquivo).

Em `server/models.ts`, no fim:

```ts
export interface MarketIndexDoc {
  _id: string; // "IBOV" | "IFIX"
  price: number;
  previousClose: number | null;
  changePercent: number;
  session: Date;
  fetchedAt: Date;
}

const marketIndexSchema = new Schema<MarketIndexDoc>(
  {
    _id: { type: String, required: true },
    price: { type: Number, required: true },
    previousClose: { type: Number, default: null },
    changePercent: { type: Number, required: true },
    session: { type: Date, required: true },
    fetchedAt: { type: Date, required: true },
  },
  { versionKey: false },
);

export const MarketIndexModel: Model<MarketIndexDoc> =
  (mongoose.models.MarketIndex as Model<MarketIndexDoc> | undefined) ??
  mongoose.model<MarketIndexDoc>("MarketIndex", marketIndexSchema, "market_indices");
```

```ts
// src/features/market-data/server/market-indices-service.ts
import "server-only";
import { connectMongo } from "@/shared/db/mongo";
import { recordError, withSpan } from "@/shared/lib/tracing";
import { getIndexQuotes } from "../adapters/yahoo";
import { isQuoteStale } from "../domain/market-hours";
import { MARKET_INDICES, marketIndexFromQuote } from "../domain/market-indices";
import { MarketIndexModel } from "./models";

export type IndicesSummary = { status: "fresh" | "updated" | "error"; updated: number };

/**
 * Atualiza o Ibovespa e o IFIX quando a última leitura venceu (a regra das cotações: 30 min no
 * pregão; fora dele, só depois do fechamento). Uma falha não lança: o resto do cron segue.
 */
export async function refreshMarketIndices(now = new Date()): Promise<IndicesSummary> {
  return withSpan("market.indices", {}, async (span) => {
    try {
      await connectMongo();
      const stored = await MarketIndexModel.find({}, { fetchedAt: 1 }).lean();
      const fetchedAt = new Map(stored.map((doc) => [doc._id, doc.fetchedAt]));
      const stale = MARKET_INDICES.filter((index) => isQuoteStale(fetchedAt.get(index.id), now));
      if (stale.length === 0) {
        span.setAttribute("koinos.indices.updated", 0);
        return { status: "fresh", updated: 0 };
      }
      const quotes = await getIndexQuotes(stale.map((index) => index.symbol));
      let updated = 0;
      for (const index of stale) {
        const quote = quotes.get(index.symbol);
        const value = quote ? marketIndexFromQuote(quote, now) : null;
        if (!value) continue;
        await MarketIndexModel.updateOne(
          { _id: index.id },
          { $set: { ...value, fetchedAt: now } },
          { upsert: true },
        );
        updated += 1;
      }
      span.setAttribute("koinos.indices.updated", updated);
      return { status: "updated", updated };
    } catch (error) {
      console.warn("[índices]", error instanceof Error ? error.message : String(error));
      recordError(span, error);
      return { status: "error", updated: 0 };
    }
  });
}
```

- [ ] **Step 5: Verificar e commitar**

Run: `npx vitest run src/features/market-data && npm run typecheck && npx eslint src/features/market-data` → sem erros. `npm run format`.

```bash
git add src/features/market-data/domain/market-indices.ts src/features/market-data/domain/market-indices.test.ts src/features/market-data/adapters/yahoo.ts src/features/market-data/server/models.ts src/features/market-data/server/market-indices-service.ts
git commit -m "feat(market-data): store Ibovespa and IFIX session change" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Coletor (`news-service.ts`)

**Goal:** Ler os feeds (gerais e por empresa em rodízio), ligar cada item aos ativos e guardar em `news_items` sem duplicar, com o estado de cada feed em `news_feeds`.

**Files:**
- Modify: `src/features/market-data/adapters/news.ts`
- Modify: `src/features/market-data/server/models.ts`
- Create: `src/features/market-data/server/news-service.ts`

**Acceptance Criteria:**
- [ ] `fetchFeed` usa o User-Agent `Koinos/1.0`, timeout de 10 s, recusa status ≠ 200 e corpo acima de 3 MB, com o host na mensagem de erro.
- [ ] `news_items` tem `_id` = sha256 da URL normalizada (24 hex), índice TTL de 14 dias em `publishedAt` e índice `{ tickers: 1, publishedAt: -1 }`; um item repetido só ganha tickers e tópicos novos (`$setOnInsert` + `$addToSet`).
- [ ] `collectNews` lê os 5 feeds gerais e até 4 feeds por empresa (`companyFeedsDue`), 3 ao mesmo tempo, sem começar um feed com menos de 11 s antes do prazo; grava `news_feeds` (`fetchedAt`, `ok`, `error`, `items`) também na falha; uma falha não para os outros feeds.
- [ ] Span `news.collect` com `koinos.news.sources`, `koinos.news.items_new`, `koinos.news.items_matched`, `koinos.news.source_errors`, `koinos.news.skipped`; sem título nem URL em span ou log.
- [ ] typecheck e lint passam.

**Verify:** `npm run typecheck && npx eslint src/features/market-data` → sem erros.

**Steps:**

- [ ] **Step 1: Adapter** — em `adapters/news.ts`, depois de `searchNews`:

```ts
/** O XML de um feed RSS. Lança com o host na mensagem quando não dá para ler. */
export async function fetchFeed(url: string): Promise<string> {
  const host = new URL(url).hostname;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${host} respondeu ${response.status}`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_PAGE_BYTES) throw new Error(`${host}: feed grande demais`);
  const xml = await response.text();
  if (xml.length > MAX_PAGE_BYTES) throw new Error(`${host}: feed grande demais`);
  return xml;
}
```

- [ ] **Step 2: Modelos** — no fim de `server/models.ts` (o nome `newsItemSchema` já existe no arquivo, para as fontes do resumo do dia; por isso `storedNewsSchema`):

```ts
export interface NewsItemDoc {
  _id: string; // sha256 da URL normalizada, 24 hex
  url: string;
  title: string;
  publisher: string;
  source: string;
  publishedAt: Date;
  description: string | null;
  tickers: string[];
  topics: string[];
  readPage: boolean;
  fetchedAt: Date;
}

const storedNewsSchema = new Schema<NewsItemDoc>(
  {
    _id: { type: String, required: true },
    url: { type: String, required: true },
    title: { type: String, required: true },
    publisher: { type: String, required: true },
    source: { type: String, required: true },
    publishedAt: { type: Date, required: true },
    description: { type: String, default: null },
    tickers: { type: [String], default: [] },
    topics: { type: [String], default: [] },
    readPage: { type: Boolean, default: true },
    fetchedAt: { type: Date, required: true },
  },
  { versionKey: false },
);
// Notícias com mais de 14 dias somem sozinhas (NEWS.keepDays).
storedNewsSchema.index({ publishedAt: 1 }, { expireAfterSeconds: 14 * 86_400 });
storedNewsSchema.index({ tickers: 1, publishedAt: -1 });

export const NewsItemModel: Model<NewsItemDoc> =
  (mongoose.models.NewsItem as Model<NewsItemDoc> | undefined) ??
  mongoose.model<NewsItemDoc>("NewsItem", storedNewsSchema, "news_items");

export interface NewsFeedDoc {
  _id: string; // URL do feed
  fetchedAt: Date;
  ok: boolean;
  error: string | null;
  items: number;
}

const newsFeedSchema = new Schema<NewsFeedDoc>(
  {
    _id: { type: String, required: true },
    fetchedAt: { type: Date, required: true },
    ok: { type: Boolean, required: true },
    error: { type: String, default: null },
    items: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const NewsFeedModel: Model<NewsFeedDoc> =
  (mongoose.models.NewsFeed as Model<NewsFeedDoc> | undefined) ??
  mongoose.model<NewsFeedDoc>("NewsFeed", newsFeedSchema, "news_feeds");
```

- [ ] **Step 3: Serviço**

```ts
// src/features/market-data/server/news-service.ts
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

export const newsIdOf = (url: string) => createHash("sha256").update(url).digest("hex").slice(0, 24);

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
      INFOMONEY_SLUGS[ticker] ? [{ ticker, url: infomoneyCompanyUrl(INFOMONEY_SLUGS[ticker]) }] : [],
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
    const summary: NewsSummary = { sources: 0, itemsNew: 0, itemsMatched: 0, sourceErrors: 0, skipped: 0 };
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
        summary.itemsNew += await upsertNews(items, now);
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
```

O `filter: { _id }` do `bulkWrite` é uma string, sem operador, então dispensa `mongoose.trusted` (o `sanitizeFilter` só barra operadores `$` em filtros). O `$in` do `find` está embrulhado.

- [ ] **Step 4: Verificar e commitar**

Run: `npm run typecheck && npx eslint src/features/market-data && npx vitest run src/features/market-data` → sem erros. `npm run format`.

```bash
git add src/features/market-data/adapters/news.ts src/features/market-data/server/models.ts src/features/market-data/server/news-service.ts
git commit -m "feat(market-data): collect news from RSS feeds into news_items" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Rota `/api/cron/news` e documentação

**Goal:** A rota do cron que junta os tickers acompanhados e roda o coletor e os índices em paralelo; a documentação do job e da coleta.

**Files:**
- Modify: `src/features/market-data/server.ts`
- Create: `src/app/api/cron/news/route.ts`
- Modify: `docs/operations/cron-job-org.md`
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-11-13-noticias-e-cenario-design.md`

**Acceptance Criteria:**
- [ ] `GET /api/cron/news` sem autorização responde 401; com ela, roda `collectNews` (prazo de 25 s a partir do início) e `refreshMarketIndices` em paralelo dentro do span `cron.news` e responde `{ news, indices }` só com contagens, `Cache-Control: no-store`.
- [ ] `docs/operations/cron-job-org.md` lista o job `Koinos – Notícias` (`*/30 7-22 * * *`, todo dia) e diz "Nos cinco".
- [ ] `CLAUDE.md` descreve a coleta (fontes, `news_items` com TTL, ligação por ticker/família/apelido, `news_feeds`, índices em `market_indices`, a rota) e os testes novos (`news.test.ts`, `market-indices.test.ts`).
- [ ] O spec registra os desvios desta etapa (spans, item sem tópico não guardado, Bing fica para a triagem).
- [ ] `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` passam.

**Verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → tudo verde.

**Steps:**

- [ ] **Step 1: Exportar** — em `src/features/market-data/server.ts`, junto das outras linhas `export`:

```ts
export { collectNews, type NewsSummary } from "./server/news-service";
export { refreshMarketIndices, type IndicesSummary } from "./server/market-indices-service";
```

- [ ] **Step 2: Rota**

```ts
// src/app/api/cron/news/route.ts
import { collectNews, refreshMarketIndices } from "@/features/market-data/server";
import { listAllTargetRanks } from "@/features/strategy/server";
import { listHeldQuantities } from "@/features/transactions/server";
import { withSpan } from "@/shared/lib/tracing";
import { isCronAuthorized } from "../authorize";

export const maxDuration = 60;

/**
 * Notícias da semana e índices do mercado (spec 2026-11-13-noticias-e-cenario-design.md).
 * Chamado pelo cron-job.org de 30 em 30 min, das 07:00 às 22:30, todo dia
 * (docs/operations/cron-job-org.md). Lê os feeds RSS e guarda as notícias dos ativos
 * acompanhados e do cenário; no pregão, atualiza o Ibovespa e o IFIX. Responde só contagens.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }
  const startedAt = Date.now();
  return withSpan("cron.news", {}, async () => {
    const [held, targets] = await Promise.all([listHeldQuantities(), listAllTargetRanks()]);
    const tickers = [...new Set([...held.map(({ ticker }) => ticker), ...targets.map(({ ticker }) => ticker)])];
    const [news, indices] = await Promise.all([
      collectNews(tickers, { deadline: startedAt + 25_000 }),
      refreshMarketIndices(),
    ]);
    return Response.json({ news, indices }, { headers: { "Cache-Control": "no-store" } });
  });
}
```

Conferir que `listHeldQuantities` e `listAllTargetRanks` são os mesmos usados por `src/app/api/cron/radar/route.ts` (são) e que nenhuma quantidade sai na resposta (só os tickers entram no coletor).

- [ ] **Step 3: `docs/operations/cron-job-org.md`**

Na tabela "Os jobs", acrescentar a linha (alinhada pelo Prettier):

```
| `Koinos – Notícias` | `https://koinos-sooty.vercel.app/api/cron/news` | todo dia, a cada 30 min das 07:00 às 22:30 (`*/30 7-22 * * *`) |
```

Depois do parágrafo do resumo e do Radar, um parágrafo novo:

```
O job de notícias lê os feeds RSS de Suno, fiis.com.br, InfoMoney e Money Times (cada um traz só 10 itens, por isso de 30 em 30 min) e até 4 feeds de empresa da InfoMoney por chamada, e guarda as notícias dos ativos acompanhados e do cenário por 14 dias. No pregão, também atualiza o Ibovespa e o IFIX. Não usa o Gemini.
```

E trocar "Nos quatro:" por "Nos cinco:".

- [ ] **Step 4: `CLAUDE.md`**

Na seção "Market data", depois do item "Indicadores (Fundamentus `detalhes.php`)", acrescentar:

```
- **Notícias e índices (etapa 2 do spec `2026-11-13-noticias-e-cenario-design.md`):** `/api/cron/news` (cron-job.org, `*/30 7-22 * * *`, todo dia) roda `collectNews` (`server/news-service.ts`) e `refreshMarketIndices` em paralelo.
  - Fontes em `NEWS_SOURCES` (`domain/news.ts`, testadas em 2026-11-13, 10 itens por feed): Suno (só título e resumo; o robots.txt dela bloqueia robôs de IA, então a página nunca é lida nem vai à IA: `readPage: false`), fiis.com.br, InfoMoney e Money Times (geral e Política). Mais os feeds por empresa da InfoMoney (`INFOMONEY_SLUGS`; SEER3 dá 404), no máximo 4 por chamada e cada um a cada 2 h (`companyFeedsDue`, estado em `news_feeds`). Investing, Funds Explorer (Cloudflare) e Bora Investir (B3) ficaram de fora.
  - `parseRssFeed` (resumo sem HTML nem rodapé do WordPress, até 400 caracteres) e `matchTickers` ligam cada item aos tickers acompanhados (posições + Carteira Alvo): o código exato, a família (PETR3 → PETR4) e os apelidos de `NEWS_ALIASES` com caixa exata ("Vale" sozinho não). Feed de ativos sem ticker não é guardado; feed de cenário guarda com o tópico `cenario`.
  - `news_items` (`_id` = sha256 da URL sem `utm_*`, TTL de 14 dias em `publishedAt`): um item repetido só ganha tickers e tópicos. User-Agent `Koinos/1.0`, 3 feeds ao mesmo tempo, nenhum começa com menos de 11 s do prazo de 25 s.
  - `market_indices`: Ibovespa (`^BVSP`) e IFIX (`IFIX.SA`) do Yahoo, com a variação do pregão (`marketIndexFromQuote`, `domain/market-indices.ts`), só quando vencidos (`isQuoteStale`).
  - Nada disso aparece na tela ainda: é a base da triagem por ativo, do cenário e da comparação com o índice (etapas seguintes).
```

Na lista de testes, acrescentar:

```
  - as notícias (`market-data/domain/news.test.ts`: o RSS com CDATA, entidades, guid e itens inválidos, o resumo limpo e cortado, a URL sem utm, `matchTickers` com família e apelidos, os tópicos e a idade em `newsItemFromFeed`, o rodízio de `companyFeedsDue`) e os índices (`market-data/domain/market-indices.test.ts`);
```

- [ ] **Step 5: Spec** — em `docs/superpowers/specs/2026-11-13-noticias-e-cenario-design.md`, no fim da seção "Camada 2", acrescentar:

```
### Decisões da implementação (etapa 2, 2026-11-13)

- Notícia de feed só de ativos (Suno, fiis.com.br) sem ticker acompanhado não é guardada.
- A rota abre o span `cron.news`; os atributos `koinos.news.*` ficam no `news.collect` e os índices no `market.indices`.
- O Bing por ticker e os termos fixos do cenário entram nas etapas da triagem e do cenário.
- SEER3 não tem feed por empresa na InfoMoney (404).
```

- [ ] **Step 6: Verificar e commitar**

Run: `npm run format && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → tudo verde.

```bash
git add src/features/market-data/server.ts src/app/api/cron/news/route.ts docs/operations/cron-job-org.md CLAUDE.md docs/superpowers/specs/2026-11-13-noticias-e-cenario-design.md
git commit -m "feat(market-data): news cron route and docs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Depois do deploy (dono):** criar o job `Koinos – Notícias` no cron-job.org como os outros (GET, HTTP Basic `cron`, timeout 30 s, `*/30 7-22 * * *`). Na primeira chamada, a resposta deve trazer `news.sources` = 9 (5 gerais + 4 por empresa) e `news.itemsNew` > 0.
