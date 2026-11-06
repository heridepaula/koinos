import "server-only";
import type { FundamentusPage } from "../domain/fundamentus";

// Fundamentus: páginas públicas de proventos, lidas uma vez por dia por ativo da carteira. O
// cliente se identifica como é (sem se passar por navegador). Se o site passar a bloquear, a
// busca falha e o "a receber" volta à estimativa do Yahoo.
const BASE_URL = "https://www.fundamentus.com.br";
const USER_AGENT = "Koinos/1.0 (painel pessoal de carteira)";
const TIMEOUT_MS = 10_000;
const PATHS: Record<FundamentusPage, string> = {
  fii: "fii_proventos.php",
  acao: "proventos.php",
};

/** O HTML da página de proventos (o site responde em ISO-8859-1). */
export async function fetchFundamentusDividendsPage(
  ticker: string,
  page: FundamentusPage,
): Promise<string> {
  const url = `${BASE_URL}/${PATHS[page]}?papel=${encodeURIComponent(ticker)}&tipo=2`;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Fundamentus respondeu ${response.status} para ${ticker}`);
  return new TextDecoder("latin1").decode(await response.arrayBuffer());
}
