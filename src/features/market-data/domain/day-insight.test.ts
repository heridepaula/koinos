import { describe, expect, it } from "vitest";
import {
  availableModels,
  buildInsightPrompt,
  crossesThreshold,
  GEMINI_MODELS,
  isSameDay,
  nextInsightAttempt,
  parseBingNews,
  prioritizeInsights,
  readFirstArticles,
  recentNews,
  shouldCallGemini,
  type DayInsight,
  type NewsItem,
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
  status: "ok",
  text: "Resumo.",
  sameDay: false,
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

describe("isSameDay", () => {
  it("pelo dia de São Paulo, não pelo UTC", () => {
    // 02:30 UTC de 12/11 é 23:30 de 11/11 em São Paulo; 03:00 UTC já é 00:00 de 12/11.
    expect(isSameDay(new Date(Date.UTC(2026, 10, 12, 2, 30)), SESSION)).toBe(false);
    expect(isSameDay(new Date(Date.UTC(2026, 10, 12, 3, 0)), SESSION)).toBe(true);
    expect(isSameDay(new Date(Date.UTC(2026, 10, 13, 2, 59)), SESSION)).toBe(true);
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

describe("nextInsightAttempt", () => {
  it("sem resumo, ou com resumo de outro pregão, processa", () => {
    expect(nextInsightAttempt(null, SESSION, sp(14))).toBe(true);
    const old = insight({ session: new Date(Date.UTC(2026, 10, 11)), sameDay: true });
    expect(nextInsightAttempt(old, SESSION, sp(14))).toBe(true);
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

describe("shouldCallGemini", () => {
  const sameDayItem = news("hoje", sp(9));
  const yesterday = news("ontem", sp(18, 0, 11));

  it("sem notícia, nunca", () => {
    expect(shouldCallGemini(null, [], SESSION)).toBe(false);
  });

  it("sem resumo deste pregão, ou com um que falhou ou não teve notícia, chama", () => {
    expect(shouldCallGemini(null, [yesterday], SESSION)).toBe(true);
    expect(shouldCallGemini(insight({ status: "failed" }), [yesterday], SESSION)).toBe(true);
    expect(shouldCallGemini(insight({ status: "no-news" }), [yesterday], SESSION)).toBe(true);
    const other = insight({ session: new Date(Date.UTC(2026, 10, 11)) });
    expect(shouldCallGemini(other, [yesterday], SESSION)).toBe(true);
  });

  it("com resumo, só quando aparece notícia do dia nova", () => {
    const current = insight({ sources: [yesterday] });
    expect(shouldCallGemini(current, [yesterday], SESSION)).toBe(false);
    expect(shouldCallGemini(current, [news("outra-de-ontem", sp(19, 0, 11))], SESSION)).toBe(false);
    expect(shouldCallGemini(current, [sameDayItem, yesterday], SESSION)).toBe(true);
    const known = insight({ sources: [sameDayItem] });
    expect(shouldCallGemini(known, [sameDayItem], SESSION)).toBe(false);
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
