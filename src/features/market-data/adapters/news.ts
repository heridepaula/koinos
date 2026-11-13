import "server-only";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { parseBingNews, type NewsItem } from "../domain/day-insight";
import { bingSearchUrl, type BingNewsItem } from "../domain/news";

// Notícias para o resumo da IA: a busca no RSS do Bing Notícias e a leitura das páginas dos
// portais. O cliente se identifica como é (sem se passar por navegador), como no Fundamentus. O
// Google Notícias ficou de fora: o link de cada notícia só abre por JavaScript.
const USER_AGENT = "Koinos/1.0 (painel pessoal de carteira)";
const SEARCH_TIMEOUT_MS = 10_000;
const PAGE_TIMEOUT_MS = 8_000;
/** Páginas maiores que isso não são lidas (texto de notícia cabe com folga). */
const MAX_PAGE_BYTES = 3 * 1024 * 1024;

/** As notícias do ativo no Bing (pt-BR), da mais recente para a mais antiga, com o resumo. */
export async function searchNews(ticker: string): Promise<BingNewsItem[]> {
  const response = await fetch(bingSearchUrl(ticker), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml" },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Bing Notícias respondeu ${response.status} para ${ticker}`);
  return parseBingNews(await response.text());
}

/** O XML de um feed RSS. Lança com o host na mensagem quando não dá para ler. */
export async function fetchFeed(url: string): Promise<string> {
  const host = new URL(url).hostname;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    // Erro de rede ou tempo esgotado: a mensagem precisa dizer de qual feed veio.
    throw new Error(`${host}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) throw new Error(`${host} respondeu ${response.status}`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_PAGE_BYTES) throw new Error(`${host}: feed grande demais`);
  let xml: string;
  try {
    xml = await response.text();
  } catch (error) {
    throw new Error(`${host}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (xml.length > MAX_PAGE_BYTES) throw new Error(`${host}: feed grande demais`);
  return xml;
}

/**
 * O texto principal da página da notícia (Readability), ou null quando não dá para ler: status
 * diferente de 200, conteúdo que não é HTML, página grande demais ou sem texto.
 */
export async function readArticle(item: NewsItem): Promise<string | null> {
  const response = await fetch(item.url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    redirect: "follow",
    cache: "no-store",
  });
  if (!response.ok) return null;
  if (!(response.headers.get("content-type") ?? "").includes("html")) return null;
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_PAGE_BYTES) return null;
  const html = await response.text();
  if (html.length > MAX_PAGE_BYTES) return null;
  const { document } = parseHTML(html);
  const article = new Readability(document as unknown as Document).parse();
  const text = article?.textContent?.trim();
  return text ? text : null;
}
