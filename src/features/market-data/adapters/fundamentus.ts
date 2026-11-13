import "server-only";
import { createLimiter } from "@/shared/lib/concurrency";
import { recordSpan } from "@/shared/lib/tracing";
import type { FundamentusPage } from "../domain/fundamentus";

// Fundamentus: páginas públicas de proventos e de indicadores, lidas uma vez por dia por ativo
// da carteira. O cliente se identifica como é (sem se passar por navegador). Se o site passar a
// bloquear, a busca falha: o "a receber" volta à estimativa do Yahoo e o Radar fica sem chips.
const BASE_URL = "https://www.fundamentus.com.br";
const USER_AGENT = "Koinos/1.0 (painel pessoal de carteira)";
const TIMEOUT_MS = 10_000;
const PATHS: Record<FundamentusPage, string> = {
  fii: "fii_proventos.php",
  acao: "proventos.php",
};
/** Poucas requisições ao mesmo tempo, somando todas as etapas: o site é de terceiros. */
const CONCURRENCY = 2;
/**
 * A mesma página serve aos proventos (histórico) e às datas de pagamento: dentro desta janela,
 * a segunda etapa reusa a resposta (ou a requisição ainda em andamento) em vez de baixar de novo.
 */
const REUSE_MS = 5 * 60 * 1000;

const limit = createLimiter(CONCURRENCY);
const recent = new Map<string, { at: number; html: Promise<string> }>();

async function download(url: string, ticker: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Fundamentus respondeu ${response.status} para ${ticker}`);
  return new TextDecoder("latin1").decode(await response.arrayBuffer());
}

function fetchReused(url: string, ticker: string, page: string): Promise<string> {
  const now = Date.now();
  for (const [key, entry] of recent) if (now - entry.at > REUSE_MS) recent.delete(key);
  const cached = recent.get(url);
  if (cached) {
    // Sem requisição, sem span de fetch: este span mostra no APM quantas o reuso poupou.
    recordSpan("fundamentus.reuse", { "koinos.fundamentus.page": page });
    return cached.html;
  }
  const html = limit(() => download(url, ticker));
  recent.set(url, { at: now, html });
  // Falha não fica guardada: a próxima chamada tenta de novo.
  html.catch(() => recent.delete(url));
  return html;
}

/** O HTML da página de proventos (o site responde em ISO-8859-1). */
export function fetchFundamentusDividendsPage(
  ticker: string,
  page: FundamentusPage,
): Promise<string> {
  const url = `${BASE_URL}/${PATHS[page]}?papel=${encodeURIComponent(ticker)}&tipo=2`;
  return fetchReused(url, ticker, page);
}

/** O HTML da página de indicadores (`detalhes.php`), para o Radar de fundamentos. */
export function fetchFundamentusDetailsPage(ticker: string): Promise<string> {
  const url = `${BASE_URL}/detalhes.php?papel=${encodeURIComponent(ticker)}`;
  return fetchReused(url, ticker, "detalhes");
}
