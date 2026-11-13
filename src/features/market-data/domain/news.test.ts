import { describe, expect, it } from "vitest";
import { cleanDescription, normalizeNewsUrl, parseRssFeed } from "./news";

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
