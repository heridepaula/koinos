import { describe, expect, it } from "vitest";
import {
  bingSearchUrl,
  canReadPage,
  cleanDescription,
  COMPANY_FEED_SOURCE,
  feedsDue,
  matchTickers,
  NEWS,
  NEWS_SOURCES,
  newsItemFromBing,
  newsItemFromFeed,
  normalizeNewsUrl,
  parseRssFeed,
  type BingNewsItem,
  type FeedItem,
} from "./news";

const item = (body: string) => `<item>${body}</item>`;
const feed = (...items: string[]) =>
  `<?xml version="1.0"?><rss><channel><link>https://site</link>${items.join("")}</channel></rss>`;

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
        item(
          "<title>A</title><guid>https://a.com/1</guid><pubDate>Thu, 12 Nov 2026 10:00:00 +0000</pubDate>",
        ),
        item(
          "<title>B</title><link>https://a.com/2</link><pubDate>Fri, 13 Nov 2026 10:00:00 +0000</pubDate>",
        ),
        item(
          "<title>C</title><link>https://a.com/2</link><pubDate>Fri, 13 Nov 2026 11:00:00 +0000</pubDate>",
        ),
        item(
          "<title></title><link>https://a.com/3</link><pubDate>Fri, 13 Nov 2026 10:00:00 +0000</pubDate>",
        ),
        item(
          "<title>D</title><link>ftp://a.com/4</link><pubDate>Fri, 13 Nov 2026 10:00:00 +0000</pubDate>",
        ),
        item("<title>E</title><link>https://a.com/5</link><pubDate>ontem</pubDate>"),
      ),
    );
    expect(items.map((i) => i.title)).toEqual(["B", "A"]);
    expect(items[1].description).toBeNull();
  });
});

describe("parseRssFeed, casos de borda", () => {
  const pub = "<pubDate>Fri, 13 Nov 2026 13:41:19 +0000</pubDate>";

  it("mantém < e > do texto do título", () => {
    const [first] = parseRssFeed(
      feed(item(`<title>Selic &lt; 10% e IPCA &gt; 4%</title><link>https://x.com/a</link>${pub}`)),
    );
    expect(first.title).toBe("Selic < 10% e IPCA > 4%");
  });

  it("usa o guid com atributo quando não há link", () => {
    const [first] = parseRssFeed(
      feed(item(`<title>T</title><guid isPermaLink="true">https://x.com/g</guid>${pub}`)),
    );
    expect(first.url).toBe("https://x.com/g");
  });

  it("ignora quebras de linha em volta do CDATA", () => {
    const [first] = parseRssFeed(
      feed(
        item(`<title>
<![CDATA[Título]]>
</title><link>https://x.com/b</link>${pub}`),
      ),
    );
    expect(first.title).toBe("Título");
  });

  it("junta CDATA dividido", () => {
    const [first] = parseRssFeed(
      feed(
        item(`<title><![CDATA[a ]]]]><![CDATA[> b]]></title><link>https://x.com/c</link>${pub}`),
      ),
    );
    expect(first.title).toBe("a ]]> b");
  });
});

describe("cleanDescription", () => {
  it("não corta em 'no post do Instagram' e tira só o rodapé final", () => {
    expect(
      cleanDescription(
        "Ele disse no post do Instagram que a Petrobras subiu. O post X apareceu primeiro em Money Times.",
      ),
    ).toBe("Ele disse no post do Instagram que a Petrobras subiu.");
  });

  it("não mexe em 'compost' nem em 'post' em minúsculas", () => {
    expect(cleanDescription("O compost post apareceu primeiro em casa")).toBe(
      "O compost post apareceu primeiro em casa",
    );
  });

  it("corta no último rodapé", () => {
    expect(
      cleanDescription("A. The post A appeared first on X. The post B appeared first on Y."),
    ).toBe("A. The post A appeared first on X.");
  });

  it("não confunde < e > do texto com tags", () => {
    expect(cleanDescription("Selic &lt; 10% e IPCA &gt; 4%")).toBe("Selic < 10% e IPCA > 4%");
    expect(cleanDescription("Selic < 10% e <b>IPCA</b> > 4%")).toBe("Selic < 10% e IPCA > 4%");
  });

  it("tira HTML, rodapé em pt e junta espaços", () => {
    expect(
      cleanDescription("<p>Um   texto</p>\n<p>O post X apareceu primeiro em Money Times.</p>"),
    ).toBe("Um texto");
  });

  it("tira a imagem da InfoMoney mesmo com HTML dentro de um atributo", () => {
    const raw =
      '<p><img width="300" alt="" data-image-caption="<p>Petrobras X Vale (Imagem feita com IA)</p>" data-large-file="https://x/y.png?fit=1280%2C853" /></p><p>Recuperação do minério mudou o jogo.</p>';
    expect(cleanDescription(raw)).toBe("Recuperação do minério mudou o jogo.");
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
    expect(normalizeNewsUrl("https://Site.com/a?id=1&utm_medium=x#c")).toBe(
      "https://site.com/a?id=1",
    );
  });

  it("recusa o que não é http(s) ou não é URL", () => {
    expect(normalizeNewsUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeNewsUrl("nada")).toBeNull();
  });
});

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
    expect(matchTickers("A mineradora Vale e o Banco do Brasil", tracked)).toEqual([
      "BBAS3",
      "VALE3",
    ]);
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
    expect(
      newsItemFromFeed(feedItem({ title: "Mercado sobe" }), source("fiis"), tracked, now),
    ).toBeNull();
  });

  it("fonte de cenário: guarda sem ticker; com ticker, os dois tópicos", () => {
    expect(
      newsItemFromFeed(
        feedItem({ title: "Senado aprova pacote" }),
        source("moneytimes-politica"),
        tracked,
        now,
      ),
    ).toMatchObject({ tickers: [], topics: ["cenario"] });
    expect(newsItemFromFeed(feedItem(), source("infomoney"), tracked, now)?.topics).toEqual([
      "ativo",
      "cenario",
    ]);
  });

  it("a Suno não tem a página lida", () => {
    expect(newsItemFromFeed(feedItem(), source("suno"), tracked, now)?.readPage).toBe(false);
  });

  it("idade: até 14 dias e no máximo 1 h no futuro", () => {
    const day = 86_400_000;
    expect(
      newsItemFromFeed(
        feedItem({ publishedAt: new Date(now.getTime() - 15 * day) }),
        source("fiis"),
        tracked,
        now,
      ),
    ).toBeNull();
    expect(
      newsItemFromFeed(
        feedItem({ publishedAt: new Date(now.getTime() + 2 * 3_600_000) }),
        source("fiis"),
        tracked,
        now,
      ),
    ).toBeNull();
  });

  it("feed por empresa acrescenta o ticker do feed", () => {
    const item = newsItemFromFeed(
      feedItem({ title: "Estatal muda diretoria" }),
      COMPANY_FEED_SOURCE,
      tracked,
      now,
      "PETR4",
    );
    expect(item).toMatchObject({
      tickers: ["PETR4"],
      topics: ["ativo"],
      source: "infomoney-empresa",
    });
  });
});

describe("feedsDue", () => {
  const now = new Date("2026-11-13T15:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
  const feeds = ["A", "B", "C", "D", "E", "F"].map((t) => ({ ticker: t, url: `u/${t}` }));
  const last = new Map([
    ["u/A", hoursAgo(1)],
    ["u/B", hoursAgo(5)],
    ["u/C", hoursAgo(3)],
    ["u/D", hoursAgo(2)],
  ]);

  it("feeds por empresa: nunca lidos primeiro, depois os mais antigos; 2 h e no máximo 4", () => {
    const rule = { everyHours: NEWS.companyFeedEveryHours, perCall: NEWS.companyFeedsPerCall };
    expect(feedsDue(feeds, last, now, rule).map((f) => f.ticker)).toEqual(["E", "F", "B", "C"]);
  });

  it("busca do Bing: a cada 6 h por ticker", () => {
    const rule = { everyHours: NEWS.bingEveryHours, perCall: NEWS.bingPerCall };
    const bing = new Map([...last, ["u/E", hoursAgo(6)], ["u/F", hoursAgo(5.9)]]);
    expect(feedsDue(feeds, bing, now, rule).map((f) => f.ticker)).toEqual(["E"]);
  });
});

describe("bingSearchUrl", () => {
  it("busca o ticker no Bing Notícias em RSS, em pt-BR", () => {
    expect(bingSearchUrl("TRXF11")).toBe(
      "https://www.bing.com/news/search?q=TRXF11&format=rss&setlang=pt-BR&cc=BR",
    );
  });
});

describe("canReadPage", () => {
  it("a Suno (com subdomínios) nunca tem a página lida; os outros portais, sim", () => {
    expect(canReadPage("https://www.suno.com.br/noticias/a/")).toBe(false);
    expect(canReadPage("https://suno.com.br/noticias/a/")).toBe(false);
    expect(canReadPage("https://conteudo.suno.com.br/a")).toBe(false);
    expect(canReadPage("https://fiis.com.br/noticias/a/")).toBe(true);
    expect(canReadPage("https://naosuno.com.br/a")).toBe(true);
  });

  it("URL inválida não é lida", () => {
    expect(canReadPage("não é url")).toBe(false);
  });
});

describe("newsItemFromBing", () => {
  const now = new Date("2026-11-13T15:00:00Z");
  const fiis = ["TRXF11", "VRTA11", "HGLG11"];
  const bingItem = (over: Partial<BingNewsItem> = {}): BingNewsItem => ({
    title: "TRXF11: O resultado de outubro foi ruim? Veja o que diz a gestora",
    publisher: "FIIs",
    url: "https://fiis.com.br/noticias/trxf11-resultado-outubro-gestora/",
    publishedAt: new Date("2026-11-12T06:40:00Z"),
    description: "O TRX Real Estate (TRXF11) registrou resultado recorrente de R$ 0,63 por cota.",
    ...over,
  });

  it("guarda com o portal, o resumo, o tópico ativo e a fonte bing", () => {
    expect(newsItemFromBing(bingItem(), "TRXF11", fiis, now)).toEqual({
      url: "https://fiis.com.br/noticias/trxf11-resultado-outubro-gestora/",
      title: "TRXF11: O resultado de outubro foi ruim? Veja o que diz a gestora",
      publisher: "FIIs",
      source: "bing",
      publishedAt: new Date("2026-11-12T06:40:00Z"),
      description: "O TRX Real Estate (TRXF11) registrou resultado recorrente de R$ 0,63 por cota.",
      tickers: ["TRXF11"],
      topics: ["ativo"],
      readPage: true,
    });
  });

  it("liga os outros acompanhados citados; a Suno vinda do Bing não tem a página lida", () => {
    const item = newsItemFromBing(
      bingItem({
        title: "VRTA11 e TRXF11 pagam hoje",
        url: "https://www.suno.com.br/noticias/a/",
        description: null,
      }),
      "TRXF11",
      fiis,
      now,
    );
    expect(item).toMatchObject({ tickers: ["TRXF11", "VRTA11"], readPage: false });
  });

  it("resultado que não cita o ticker buscado fica de fora", () => {
    const item = bingItem({ title: "IFIX fecha em queda", description: "O índice recuou." });
    expect(newsItemFromBing(item, "TRXF11", fiis, now)).toBeNull();
  });

  it("idade: até 14 dias e no máximo 1 h no futuro", () => {
    const day = 86_400_000;
    const old = bingItem({ publishedAt: new Date(now.getTime() - 15 * day) });
    const future = bingItem({ publishedAt: new Date(now.getTime() + 2 * 3_600_000) });
    expect(newsItemFromBing(old, "TRXF11", fiis, now)).toBeNull();
    expect(newsItemFromBing(future, "TRXF11", fiis, now)).toBeNull();
  });
});
