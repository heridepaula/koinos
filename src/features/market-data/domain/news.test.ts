import { describe, expect, it } from "vitest";
import {
  cleanDescription,
  COMPANY_FEED_SOURCE,
  companyFeedsDue,
  matchTickers,
  NEWS_SOURCES,
  newsItemFromFeed,
  normalizeNewsUrl,
  parseRssFeed,
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

describe("cleanDescription", () => {
  it("tira HTML, rodapé em pt e junta espaços", () => {
    expect(
      cleanDescription("<p>Um   texto</p>\n<p>O post X apareceu primeiro em Money Times.</p>"),
    ).toBe("Um texto");
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
