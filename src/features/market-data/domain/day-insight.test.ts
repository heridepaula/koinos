import { describe, expect, it } from "vitest";
import {
  availableModels,
  buildInsightPrompt,
  crossesThreshold,
  GEMINI_MODELS,
  geminiLimitScope,
  insightMarket,
  insightPlan,
  isSessionNews,
  marketReading,
  marketReadingText,
  mergeSessionNews,
  nextInsightAttempt,
  parseBingNews,
  prioritizeInsights,
  quoteSettled,
  readFirstArticles,
  recentNews,
  sameMovement,
  weekNews,
  withInsightDefaults,
  type DayInsight,
  type InsightNews,
  type NewsItem,
  type StoredNews,
} from "./day-insight";

// Quinta, 12/11/2026. São Paulo é UTC−3.
const SESSION = new Date(Date.UTC(2026, 10, 12));
const sp = (hour: number, minute = 0, day = 12) =>
  new Date(Date.UTC(2026, 10, day, hour + 3, minute));

const news = (url: string, publishedAt: Date, title = url): NewsItem => ({
  title,
  publisher: "Portal",
  url: `https://portal.com.br/${url}`,
  publishedAt,
});

const insight = (overrides: Partial<DayInsight> = {}): DayInsight => ({
  session: SESSION,
  changePercent: 0.025,
  kind: "day",
  status: "ok",
  text: "Resumo.",
  sameDay: false,
  market: null,
  sources: [],
  model: "gemini-3.8-flash",
  generatedAt: sp(10, 30),
  attemptedAt: sp(10, 30),
  ...overrides,
});

describe("crossesThreshold", () => {
  it("FII a partir de 2%, nos dois sentidos", () => {
    expect(crossesThreshold("FII", 0.0199)).toBe(false);
    expect(crossesThreshold("FII", 0.02)).toBe(true);
    expect(crossesThreshold("FII", -0.02)).toBe(true);
    expect(crossesThreshold("FII", 0.019999999999)).toBe(true);
  });

  it("ação a partir de 3%; sem classe vale o limite das ações", () => {
    expect(crossesThreshold("ACAO", 0.0299)).toBe(false);
    expect(crossesThreshold("ACAO", 0.03)).toBe(true);
    expect(crossesThreshold("ACAO", -0.031)).toBe(true);
    expect(crossesThreshold(null, 0.025)).toBe(false);
    expect(crossesThreshold(null, 0.03)).toBe(true);
  });

  it("sem variação, não dispara", () => {
    expect(crossesThreshold("FII", null)).toBe(false);
    expect(crossesThreshold("FII", undefined)).toBe(false);
    expect(crossesThreshold("FII", Number.NaN)).toBe(false);
  });
});

const RSS = `<?xml version="1.0" encoding="utf-8" ?><rss version="2.0"><channel><title>PETR4 - BingNot&#237;cias</title>
<item><title>Petrobras (PETR4) tomba ap&#243;s resultados</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;tid=1&amp;url=https%3a%2f%2fvalorinveste.globo.com%2fmercados%2fpetr4.ghtml&amp;c=5&amp;mkt=pt-br</link><description>Lucro de R$ 39,7 bi</description><pubDate>Wed, 11 Nov 2026 05:33:00 GMT</pubDate><News:Source>Valor Investe</News:Source></item>
<item><title>Mais recente</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;url=https%3a%2f%2fwww.fiis.com.br%2fnoticias%2fa%2f</link><pubDate>Thu, 12 Nov 2026 14:00:00 GMT</pubDate></item>
<item><title>Repetida</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;url=https%3a%2f%2fvalorinveste.globo.com%2fmercados%2fpetr4.ghtml</link><pubDate>Thu, 12 Nov 2026 15:00:00 GMT</pubDate></item>
<item><title>Sem link http</title><link>http://www.bing.com/news/apiclick.aspx?url=javascript%3aalert(1)</link><pubDate>Thu, 12 Nov 2026 15:00:00 GMT</pubDate></item>
<item><title>Sem data</title><link>http://www.bing.com/news/apiclick.aspx?url=https%3a%2f%2fa.com%2fx</link><pubDate>ontem</pubDate></item>
</channel></rss>`;

describe("parseBingNews", () => {
  it("tira a URL do portal do url= e ordena da mais recente para a mais antiga", () => {
    const items = parseBingNews(RSS);
    expect(items.map((item) => item.url)).toEqual([
      "https://www.fiis.com.br/noticias/a/",
      "https://valorinveste.globo.com/mercados/petr4.ghtml",
    ]);
  });

  it("decodifica o título, lê o portal e, sem ele, usa o domínio", () => {
    const [recent, older] = parseBingNews(RSS);
    expect(older.title).toBe("Petrobras (PETR4) tomba após resultados");
    expect(older.publisher).toBe("Valor Investe");
    expect(older.publishedAt.toISOString()).toBe("2026-11-11T05:33:00.000Z");
    expect(recent.publisher).toBe("fiis.com.br");
  });

  it("guarda o resumo do Bing, limpo; sem resumo, null", () => {
    const [recent, older] = parseBingNews(RSS);
    expect(older.description).toBe("Lucro de R$ 39,7 bi");
    expect(recent.description).toBeNull();
  });

  it("deixa de fora URL repetida, link que não é http(s) e data inválida", () => {
    const titles = parseBingNews(RSS).map((item) => item.title);
    expect(titles).not.toContain("Repetida");
    expect(titles).not.toContain("Sem link http");
    expect(titles).not.toContain("Sem data");
  });

  it("RSS vazio ou quebrado não dá notícia", () => {
    expect(parseBingNews("")).toEqual([]);
    expect(parseBingNews("<html>erro</html>")).toEqual([]);
  });
});

describe("recentNews", () => {
  it("só as de até 7 dias", () => {
    const now = sp(11);
    const items = [news("a", sp(9)), news("b", sp(9, 0, 5)), news("c", sp(12, 0, 5))];
    expect(recentNews(items, now).map((item) => item.url)).toEqual([
      "https://portal.com.br/a",
      "https://portal.com.br/c",
    ]);
  });
});

describe("readFirstArticles", () => {
  const items = ["a", "b", "c", "d", "e"].map((id) => news(id, sp(10)));

  it("pula a que falha e para em 3", async () => {
    const tried: string[] = [];
    const result = await readFirstArticles(items, async (item) => {
      tried.push(item.url.slice(-1));
      if (item.url.endsWith("a")) throw new Error("rede");
      if (item.url.endsWith("b")) return "   ";
      return `texto de ${item.url.slice(-1)}`;
    });
    expect(result.articles.map((article) => article.text)).toEqual([
      "texto de c",
      "texto de d",
      "texto de e",
    ]);
    expect(result.failed).toBe(2);
    expect(tried).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("não lê além das 3 que deram certo", async () => {
    const tried: string[] = [];
    await readFirstArticles(items, async (item) => {
      tried.push(item.url);
      return "ok";
    });
    expect(tried).toHaveLength(3);
  });

  it("junta os espaços e corta o texto em 4.000 caracteres", async () => {
    const { articles } = await readFirstArticles(
      items.slice(0, 1),
      async () => `a  \n b ${"x".repeat(5000)}`,
    );
    expect(articles[0].text.startsWith("a b x")).toBe(true);
    expect(articles[0].text).toHaveLength(4000);
  });
});

describe("quoteSettled", () => {
  it("cotação buscada antes das 10:30 do pregão não vale, mesmo que agora sejam 11:00", () => {
    expect(quoteSettled(sp(10, 29), SESSION)).toBe(false);
    expect(quoteSettled(sp(9, 0), SESSION)).toBe(false);
  });

  it("a partir das 10:30 do pregão vale, inclusive no dia seguinte", () => {
    expect(quoteSettled(sp(10, 30), SESSION)).toBe(true);
    expect(quoteSettled(sp(18, 0), SESSION)).toBe(true);
    expect(quoteSettled(sp(8, 0, 13), SESSION)).toBe(true);
  });
});

describe("nextInsightAttempt", () => {
  it("sem resumo, ou com resumo de outro pregão, processa", () => {
    expect(nextInsightAttempt(null, SESSION, sp(14))).toBe(true);
    const old = insight({ session: new Date(Date.UTC(2026, 10, 11)), sameDay: true });
    expect(nextInsightAttempt(old, SESSION, sp(14))).toBe(true);
  });

  it("nada antes das 10:30 do dia do pregão, nem a primeira tentativa", () => {
    expect(nextInsightAttempt(null, SESSION, sp(10, 29))).toBe(false);
    expect(nextInsightAttempt(null, SESSION, sp(10, 30))).toBe(true);
    const old = insight({ session: new Date(Date.UTC(2026, 10, 11)), sameDay: true });
    expect(nextInsightAttempt(old, SESSION, sp(10, 15))).toBe(false);
  });

  it("com notícia do dia, o resumo é definitivo", () => {
    expect(nextInsightAttempt(insight({ sameDay: true }), SESSION, sp(11, 30))).toBe(false);
  });

  it("de manhã, 30 min depois da última tentativa", () => {
    const last = insight({ attemptedAt: sp(10, 30) });
    expect(nextInsightAttempt(last, SESSION, sp(10, 59))).toBe(false);
    expect(nextInsightAttempt(last, SESSION, sp(11, 0))).toBe(true);
  });

  it("até 11:59; das 12:00 às 17:59, não", () => {
    const last = insight({ attemptedAt: sp(11, 0) });
    expect(nextInsightAttempt(last, SESSION, sp(11, 59))).toBe(true);
    expect(nextInsightAttempt(last, SESSION, sp(12, 0))).toBe(false);
    expect(nextInsightAttempt(last, SESSION, sp(17, 59))).toBe(false);
  });

  it("volta às 18:00 e para às 20:00", () => {
    const last = insight({ attemptedAt: sp(11, 30) });
    expect(nextInsightAttempt(last, SESSION, sp(18, 0))).toBe(true);
    const evening = insight({ attemptedAt: sp(19, 0) });
    expect(nextInsightAttempt(evening, SESSION, sp(19, 29))).toBe(false);
    expect(nextInsightAttempt(evening, SESSION, sp(19, 30))).toBe(true);
    expect(nextInsightAttempt(evening, SESSION, sp(20, 0))).toBe(false);
  });

  it("um ativo que disparou à tarde só tenta de novo a partir das 18:00", () => {
    const afternoon = insight({ attemptedAt: sp(14, 0) });
    expect(nextInsightAttempt(afternoon, SESSION, sp(15, 0))).toBe(false);
    expect(nextInsightAttempt(afternoon, SESSION, sp(18, 0))).toBe(true);
  });

  it("fora do dia do pregão (madrugada seguinte, fim de semana), não", () => {
    const last = insight({ attemptedAt: sp(19, 0) });
    expect(nextInsightAttempt(last, SESSION, sp(9, 0, 13))).toBe(false);
    expect(nextInsightAttempt(last, SESSION, sp(11, 0, 14))).toBe(false);
  });
});

describe("prioritizeInsights", () => {
  it("posições por valor, depois a Carteira Alvo por rank, sem rank por último", () => {
    const prices: Record<string, number> = { AAAA11: 100, BBBB11: 10, CCCC11: 50, DDDD3: 20 };
    const ordered = prioritizeInsights(
      [
        { ticker: "ZZZZ11", quantity: null, rank: null },
        { ticker: "CCCC11", quantity: null, rank: 2 },
        { ticker: "BBBB11", quantity: 1000, rank: 9 },
        { ticker: "DDDD3", quantity: 0, rank: 1 },
        { ticker: "AAAA11", quantity: 50, rank: 1 },
      ],
      (ticker) => prices[ticker] ?? null,
    );
    expect(ordered.map((item) => item.ticker)).toEqual([
      "BBBB11",
      "AAAA11",
      "DDDD3",
      "CCCC11",
      "ZZZZ11",
    ]);
  });
});

describe("availableModels", () => {
  it("começa pelo Lite mais barato e deixa os Flash por último", () => {
    const models = availableModels(() => 0);
    expect(models.slice(0, 2)).toEqual(["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]);
    expect(models.at(-1)).toBe("gemini-3.8-flash");
  });

  it("pula o modelo que esgotou a cota do dia", () => {
    const used = (model: string) => (model === "gemini-3.5-flash-lite" ? 450 : 0);
    const models = availableModels(used);
    expect(models[0]).toBe("gemini-3.1-flash-lite");
    expect(models).not.toContain("gemini-3.5-flash-lite");
  });

  it("com todas esgotadas, nenhum", () => {
    expect(availableModels(() => Number.POSITIVE_INFINITY)).toEqual([]);
    expect(availableModels(() => 0)).toHaveLength(GEMINI_MODELS.length);
  });
});

describe("buildInsightPrompt", () => {
  const prompt = buildInsightPrompt({
    ticker: "HGLG11",
    assetClass: "FII",
    changePercent: -0.0234,
    session: SESSION,
    articles: [{ ...news("a", sp(9, 15), "CVM autoriza incorporação"), text: "Texto da notícia." }],
  });

  it("leva o ticker, a classe, a variação e as notícias", () => {
    expect(prompt).toContain("HGLG11 é um fundo imobiliário (FII)");
    expect(prompt).toContain("12/11/2026");
    expect(prompt).toContain("-2,34%");
    expect(prompt).toContain('"CVM autoriza incorporação" (Portal, 12/11/2026 09:15)');
    expect(prompt).toContain("Texto da notícia.");
    expect(prompt).toContain("Não recomende");
  });

  it("não leva nenhum dado da carteira", () => {
    expect(prompt).not.toMatch(/R\$|cotas na carteira|preço médio|posição|quantidade/i);
  });

  it("só as notícias do pregão, sem inventar causas", () => {
    expect(prompt).toContain(
      "Use só as notícias acima, todas publicadas desde o fechamento do pregão anterior.",
    );
    expect(prompt).toContain("Se elas não explicarem o movimento, diga isso; não invente causas.");
  });

  it("a notícia está acima da tarefa", () => {
    expect(prompt).toContain("Use só as notícias acima");
    expect(prompt).not.toContain("notícias abaixo");
  });

  it("o humor geral do mercado só sem leitura ou quando acompanhou", () => {
    const base = {
      ticker: "HGLG11",
      assetClass: "FII" as const,
      changePercent: -0.0234,
      session: SESSION,
      articles: [],
    };
    const humor = "humor geral do mercado";
    expect(buildInsightPrompt(base)).toContain(humor);
    const acompanhou = {
      index: "IFIX" as const,
      indexChange: -0.02,
      reading: "acompanhou" as const,
    };
    expect(buildInsightPrompt({ ...base, market: acompanhou })).toContain(humor);
    const descolou = { ...acompanhou, indexChange: 0.01, reading: "descolou" as const };
    expect(buildInsightPrompt({ ...base, market: descolou })).not.toContain(humor);
  });

  it("sem mercado, sem a linha do índice; com ele, a leitura do código", () => {
    expect(prompt).not.toContain("IFIX");
    const withMarket = buildInsightPrompt({
      ticker: "HGLG11",
      assetClass: "FII",
      changePercent: -0.0234,
      session: SESSION,
      articles: [],
      market: { index: "IFIX", indexChange: -0.004, reading: "descolou" },
    });
    expect(withMarket).toContain(
      "O IFIX caiu 0,40% neste pregão e o HGLG11 caiu 2,34%, bem diferente do mercado.",
    );
  });

  it("variação positiva com sinal e ação no texto", () => {
    const stock = buildInsightPrompt({
      ticker: "PETR4",
      assetClass: "ACAO",
      changePercent: 0.031,
      session: SESSION,
      articles: [],
    });
    expect(stock).toContain("PETR4 é uma ação");
    expect(stock).toContain("+3,10%");
  });
});

describe("isSessionNews", () => {
  // Segunda, 16/11/2026: o pregão anterior é a sexta, 13/11.
  const MONDAY = new Date(Date.UTC(2026, 10, 16));
  // Quarta, 11/11/2026.
  const WEDNESDAY = new Date(Date.UTC(2026, 10, 11));

  it("segunda conta desde sexta 18:00", () => {
    expect(isSessionNews(sp(18, 0, 13), MONDAY)).toBe(true);
    expect(isSessionNews(sp(17, 59, 13), MONDAY)).toBe(false);
    expect(isSessionNews(sp(9, 0, 15), MONDAY)).toBe(true);
  });

  it("o próprio dia até 23:59 conta; o dia seguinte, não", () => {
    expect(isSessionNews(sp(23, 59, 12), SESSION)).toBe(true);
    expect(isSessionNews(new Date(Date.UTC(2026, 10, 13, 2, 59, 59)), SESSION)).toBe(true);
    expect(isSessionNews(new Date(Date.UTC(2026, 10, 13, 3, 0)), SESSION)).toBe(false);
  });

  it("quarta conta desde terça 18:00 (instantes UTC explícitos)", () => {
    // 18:00 de São Paulo é 21:00 UTC.
    expect(isSessionNews(new Date(Date.UTC(2026, 10, 10, 21, 0)), WEDNESDAY)).toBe(true);
    expect(isSessionNews(new Date(Date.UTC(2026, 10, 10, 20, 59)), WEDNESDAY)).toBe(false);
    expect(isSessionNews(new Date(Date.UTC(2026, 10, 11, 14, 0)), WEDNESDAY)).toBe(true);
  });
});

describe("sameMovement", () => {
  it("mesmo pregão e mesmo sinal", () => {
    expect(sameMovement(insight({ changePercent: 0.025 }), SESSION, 0.031)).toBe(true);
    expect(sameMovement(insight({ changePercent: -0.025 }), SESSION, 0.0173)).toBe(false);
    const other = insight({ session: new Date(Date.UTC(2026, 10, 11)) });
    expect(sameMovement(other, SESSION, 0.025)).toBe(false);
    expect(sameMovement(null, SESSION, 0.025)).toBe(false);
  });
});

describe("withInsightDefaults", () => {
  it("documento antigo, sem kind nem market, lê como day sem mercado", () => {
    const { kind, market, ...legacy } = insight();
    void kind;
    void market;
    const read = withInsightDefaults(legacy);
    expect(read.kind).toBe("day");
    expect(read.market).toBeNull();
    expect(withInsightDefaults(insight({ kind: "week" })).kind).toBe("week");
  });
});

const stored = (
  url: string,
  publishedAt: Date,
  overrides: Partial<StoredNews> = {},
): StoredNews => ({
  ...news(url, publishedAt),
  description: `Resumo de ${url}`,
  topics: ["ativo"],
  readPage: true,
  ...overrides,
});

describe("mergeSessionNews", () => {
  it("só as do pregão, guardadas e do Bing, sem URL repetida, da mais nova à mais velha", () => {
    const merged = mergeSessionNews(
      [
        stored("a", sp(10)),
        stored("velha", sp(17, 0, 11)),
        stored("suno", sp(9), { readPage: false }),
      ],
      [
        news("b", sp(12)),
        { ...news("a", sp(10)), url: "https://portal.com.br/a?utm_source=bing" },
        news("ontem", sp(18, 30, 11)),
        news("antiga", sp(9, 0, 6)),
      ],
      SESSION,
    );
    expect(merged.map((item) => item.url)).toEqual([
      "https://portal.com.br/b",
      "https://portal.com.br/a",
      "https://portal.com.br/suno",
      "https://portal.com.br/ontem",
    ]);
    expect(merged.find((item) => item.url.endsWith("suno"))?.readPage).toBe(false);
    expect(merged.find((item) => item.url.endsWith("b"))).toMatchObject({
      readPage: true,
      description: null,
    });
  });

  it("do Bing: guarda o resumo e nunca lê a página da Suno", () => {
    const merged = mergeSessionNews(
      [],
      [
        { ...news("x", sp(11)), url: "https://www.suno.com.br/noticias/x/", description: "Trecho" },
        { ...news("y", sp(12)), description: "Outro" },
      ],
      SESSION,
    );
    expect(merged).toMatchObject([
      { url: "https://portal.com.br/y", readPage: true, description: "Outro" },
      { url: "https://www.suno.com.br/noticias/x/", readPage: false, description: "Trecho" },
    ]);
  });
});

describe("weekNews", () => {
  it("tópico ativo dos últimos 7 dias, até 10, da mais nova à mais velha", () => {
    const now = sp(14);
    const items = [
      ...Array.from({ length: 11 }, (_, index) =>
        stored(`n${String(index).padStart(2, "0")}`, sp(8 + index, 0, 10)),
      ),
      stored("cenario", sp(11), { topics: ["cenario"] }),
      stored("velha", sp(13, 0, 5)),
    ];
    expect(weekNews(items, now).map((item) => item.url.slice(-3))).toEqual([
      "n10",
      "n09",
      "n08",
      "n07",
      "n06",
      "n05",
      "n04",
      "n03",
      "n02",
      "n01",
    ]);
  });
});

describe("insightPlan", () => {
  const today = { ...news("hoje", sp(11)), description: null, readPage: true } as InsightNews;
  const week = [{ ...news("semana", sp(10, 0, 9)), description: "x", readPage: true }];

  it("notícia do pregão sem resumo deste movimento: dia", () => {
    expect(insightPlan(null, [today], week)).toEqual({ mode: "day", news: [today] });
  });

  it("notícia do pregão com resumo da semana: o dia substitui", () => {
    const previous = insight({ kind: "week", sources: [week[0]] });
    expect(insightPlan(previous, [today], week)).toEqual({ mode: "day", news: [today] });
  });

  it("resumo do dia: só com notícia do pregão fora das fontes", () => {
    const known = insight({ kind: "day", sources: [today] });
    expect(insightPlan(known, [today], week)).toEqual({ mode: "none" });
    const fresh = { ...today, url: "https://portal.com.br/nova" };
    expect(insightPlan(known, [today, fresh], week)).toEqual({
      mode: "day",
      news: [today, fresh],
    });
  });

  it("sem notícia do pregão e sem resumo: semana, mesmo com a lista vazia", () => {
    expect(insightPlan(null, [], week)).toEqual({ mode: "week", news: week });
    expect(insightPlan(null, [], [])).toEqual({ mode: "week", news: [] });
  });

  it("um resumo que falhou não conta", () => {
    expect(insightPlan(insight({ status: "failed" }), [], week)).toEqual({
      mode: "week",
      news: week,
    });
  });

  it("sem notícia do pregão e com resumo deste movimento: nada", () => {
    expect(insightPlan(insight({ kind: "week" }), [], week)).toEqual({ mode: "none" });
    expect(insightPlan(insight({ kind: "day" }), [], week)).toEqual({ mode: "none" });
  });
});

describe("marketReading", () => {
  it("limite de 1 p.p. quando o índice é pequeno, nos dois lados", () => {
    expect(marketReading(0.0199, 0.01)).toBe("acompanhou");
    expect(marketReading(0.02, 0.01)).toBe("descolou");
    expect(marketReading(0.0001, 0.01)).toBe("acompanhou");
    expect(marketReading(-0.0199, -0.01)).toBe("acompanhou");
    expect(marketReading(-0.02, -0.01)).toBe("descolou");
  });

  it("limite de 0,5 × índice quando ele é grande, nos dois lados", () => {
    expect(marketReading(0.0599, 0.04)).toBe("acompanhou");
    expect(marketReading(0.06, 0.04)).toBe("descolou");
    expect(marketReading(0.0201, 0.04)).toBe("acompanhou");
    expect(marketReading(0.02, 0.04)).toBe("descolou");
    expect(marketReading(-0.0599, -0.04)).toBe("acompanhou");
    expect(marketReading(-0.06, -0.04)).toBe("descolou");
  });

  it("sinais opostos descolam, mesmo perto; índice 0 também", () => {
    expect(marketReading(0.005, -0.002)).toBe("descolou");
    expect(marketReading(0.02, 0)).toBe("descolou");
  });

  it("o piso é parâmetro: 2 p.p. na semana", () => {
    expect(marketReading(-0.0339, -0.014, 0.02)).toBe("acompanhou");
    expect(marketReading(-0.034, -0.014, 0.02)).toBe("descolou");
    expect(marketReading(-0.127, -0.014, 0.02)).toBe("descolou");
  });
});

describe("insightMarket", () => {
  const indices = new Map([
    ["IFIX", { changePercent: 0.0082, session: SESSION }],
    ["IBOV", { changePercent: 0.004, session: new Date(Date.UTC(2026, 10, 11)) }],
  ] as const);

  it("FII contra o IFIX do mesmo pregão", () => {
    expect(insightMarket("FII", 0.0173, indices, SESSION)).toEqual({
      index: "IFIX",
      indexChange: 0.0082,
      reading: "acompanhou",
    });
  });

  it("ação contra o Ibovespa; de outro pregão ou ausente, nada", () => {
    expect(insightMarket("ACAO", 0.04, indices, SESSION)).toBeNull();
    expect(insightMarket(null, 0.04, new Map(), SESSION)).toBeNull();
    const ibov = new Map([["IBOV", { changePercent: 0.004, session: SESSION }]] as const);
    expect(insightMarket("ACAO", -0.024, ibov, SESSION)).toEqual({
      index: "IBOV",
      indexChange: 0.004,
      reading: "descolou",
    });
  });
});

describe("marketReadingText", () => {
  it("IFIX acompanhando, com vírgula e duas casas", () => {
    expect(
      marketReadingText("TRXF11", 0.0173, {
        index: "IFIX",
        indexChange: 0.0082,
        reading: "acompanhou",
      }),
    ).toBe("O IFIX subiu 0,82% neste pregão e o TRXF11 subiu 1,73%, acompanhando o mercado.");
  });

  it("Ibovespa, queda descolada", () => {
    expect(
      marketReadingText("PETR4", -0.024, {
        index: "IBOV",
        indexChange: 0.004,
        reading: "descolou",
      }),
    ).toBe("O Ibovespa subiu 0,40% neste pregão e o PETR4 caiu 2,40%, bem diferente do mercado.");
  });

  it("estável abaixo de 0,005%", () => {
    expect(
      marketReadingText("HGLG11", 0.021, {
        index: "IFIX",
        indexChange: 0.00004,
        reading: "descolou",
      }),
    ).toBe("O IFIX ficou estável neste pregão e o HGLG11 subiu 2,10%, bem diferente do mercado.");
  });
});

describe("geminiLimitScope", () => {
  const body = (...quotaIds: string[]) => ({
    error: {
      code: 429,
      details: [
        {
          "@type": "type.googleapis.com/google.rpc.QuotaFailure",
          violations: quotaIds.map((quotaId) => ({ quotaId })),
        },
        { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "19s" },
      ],
    },
  });

  it("reconhece o limite por minuto do free tier", () => {
    expect(geminiLimitScope(body("GenerateRequestsPerMinutePerProjectPerModel-FreeTier"))).toBe(
      "minute",
    );
  });

  it("reconhece a cota diária", () => {
    expect(geminiLimitScope(body("GenerateRequestsPerDayPerProjectPerModel-FreeTier"))).toBe("day");
  });

  it("com os dois, vale o diário", () => {
    expect(
      geminiLimitScope(
        body(
          "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
          "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
        ),
      ),
    ).toBe("day");
  });

  it("corpo vazio, estranho ou sem quotaId conhecido é desconhecido", () => {
    for (const garbage of [
      null,
      undefined,
      "x",
      3,
      {},
      { error: null },
      { error: { details: "x" } },
      { error: { details: [null, { violations: [null, { quotaId: 1 }] }] } },
      body("Outro"),
    ]) {
      expect(geminiLimitScope(garbage)).toBe("unknown");
    }
  });
});
