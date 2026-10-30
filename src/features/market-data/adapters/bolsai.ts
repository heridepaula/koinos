import "server-only";
import { parseBolsaiFii, type FiiFundamentals } from "../domain/fundamentals";

// usebolsai, plano gratuito: 200 chamadas por dia (zeram à 0h UTC), uma por FII. Só `/fiis/{ticker}`
// é gratuito; proventos, histórico e o screener (lote) são do Pro.
const BASE_URL = "https://api.usebolsai.com/api/v1";
const TIMEOUT_MS = 10_000;

/** VP e P/VP de um FII. Null quando a API não tem o dado (404 ou resposta sem VP). */
export async function fetchBolsaiFii(
  ticker: string,
  apiKey: string,
): Promise<FiiFundamentals | null> {
  const response = await fetch(`${BASE_URL}/fiis/${encodeURIComponent(ticker)}`, {
    headers: { "X-API-Key": apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`usebolsai respondeu ${response.status} para ${ticker}`);
  return parseBolsaiFii(await response.json());
}
