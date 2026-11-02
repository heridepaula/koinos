import "server-only";
import { parseTreasuryPackage } from "../domain/treasury-rates";

// Tesouro Transparente (Tesouro Nacional, dados abertos, licença ODbL; não é um sistema da B3).
// O catálogo CKAN é a única URL fixa: a do CSV vem dele, porque o identificador do recurso pode mudar.
const CATALOG_URL =
  "https://www.tesourotransparente.gov.br/ckan/api/3/action/package_show?id=df56aa42-484a-4a59-8184-7676580c81e3";
const CATALOG_TIMEOUT_MS = 15_000;
// O CSV tem uns 15 MB e levou 9 s numa medição; a folga cobre um dia lento.
const CSV_TIMEOUT_MS = 60_000;

/** A URL e o `last_modified` do CSV, lidos do catálogo (5 KB). */
export async function fetchTreasuryCatalog(): Promise<{ url: string; lastModified: string }> {
  const response = await fetch(CATALOG_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Tesouro Transparente (catálogo) respondeu ${response.status}`);
  return parseTreasuryPackage(await response.json());
}

export type TreasuryCsv =
  { status: "not-modified" } | { status: "ok"; text: string; etag: string | null };

/** Baixa o CSV. Com o ETag da última vez, o servidor responde 304 (0,2 s, sem corpo) se nada mudou. */
export async function fetchTreasuryCsv(url: string, etag: string | null): Promise<TreasuryCsv> {
  const response = await fetch(url, {
    headers: etag ? { "If-None-Match": etag } : {},
    signal: AbortSignal.timeout(CSV_TIMEOUT_MS),
    cache: "no-store",
  });
  if (response.status === 304) return { status: "not-modified" };
  if (!response.ok) throw new Error(`Tesouro Transparente (CSV) respondeu ${response.status}`);
  return { status: "ok", text: await response.text(), etag: response.headers.get("etag") };
}
