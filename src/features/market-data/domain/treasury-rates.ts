// Taxas dos títulos do Tesouro Direto (Tesouro Transparente; spec 2026-11-01-taxa-ntnb-design.md).
// Código puro: lê o CSV do dataset "Taxas dos Títulos Ofertados pelo Tesouro Direto", valida,
// escolhe os títulos acompanhados e resume a série. Sem Next, banco ou I/O.

/** Um título pelo tipo e pelo vencimento (aaaa-mm-dd): o nome do arquivo traz o ano errado em alguns. */
export type TrackedTitle = { kind: string; maturity: string };

/** A NTN-B com cupom que vence em 15/05/2035: o título que a fórmula de teto da Suno cita. */
export const BENCHMARK_TITLE: TrackedTitle = {
  kind: "Tesouro IPCA+ com Juros Semestrais",
  maturity: "2035-05-15",
};

/** Os títulos que o app guarda. Acrescentar um aqui basta; o resto não muda. */
export const TRACKED_TITLES: readonly TrackedTitle[] = [BENCHMARK_TITLE];

/** Pregões da mediana (decisão do dono, spec §7). */
export const MEDIAN_WINDOW = 60;
/** A taxa é velha quando a última data-base tem mais dias que isso. */
export const STALE_AFTER_DAYS = 10;
/** Acima desta fração de linhas inválidas entre as acompanhadas, o arquivo inteiro é recusado. */
export const MAX_INVALID_SHARE = 0.01;
/** Taxa fora desta faixa (em %) é inválida; salto diário não é critério. */
export const RATE_LIMITS = { min: -10, max: 30 } as const;

export const TREASURY_COLUMNS = [
  "Tipo Titulo",
  "Data Vencimento",
  "Data Base",
  "Taxa Compra Manha",
  "Taxa Venda Manha",
  "PU Compra Manha",
  "PU Venda Manha",
  "PU Base Manha",
] as const;

export type TreasuryRow = {
  kind: string;
  /** aaaa-mm-dd */
  maturity: string;
  /** aaaa-mm-dd */
  baseDate: string;
  /** % ao ano, taxa real (IPCA +). */
  buyRate: number;
  sellRate: number;
  buyPrice: number;
  sellPrice: number;
};

export type TreasurySeriesPoint = Pick<TreasuryRow, "baseDate" | "buyRate" | "sellRate">;

export type ParsedTreasury =
  | { ok: true; rows: TreasuryRow[]; invalid: number; latestBaseDate: string }
  | { ok: false; reason: string };

const NUMBER = /^-?\d+(,\d+)?$/;
const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

function parseNumber(text: string): number | null {
  return NUMBER.test(text) ? Number(text.replace(",", ".")) : null;
}

const inRange = (rate: number) => rate >= RATE_LIMITS.min && rate <= RATE_LIMITS.max;

/** "30/10/2026" vira "2026-10-30"; null quando não é uma data real. */
export function parseBrDate(text: string): string | null {
  const match = DATE.exec(text);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
}

/**
 * Lê o CSV e devolve só as linhas dos títulos acompanhados. Recusa o arquivo inteiro (sem escrever
 * nada depois) se o cabeçalho mudou, se alguma linha não tem 8 colunas, se nenhum título
 * acompanhado aparece ou se mais de 1% das linhas acompanhadas é inválida. As colunas são lidas
 * por posição, depois de conferir o cabeçalho.
 */
export function parseTreasuryCsv(
  text: string,
  tracked: readonly TrackedTitle[] = TRACKED_TITLES,
): ParsedTreasury {
  const lines = text.replace(/^﻿/, "").split("\n");
  const header = (lines[0] ?? "").replace(/\r$/, "").split(";");
  if (
    header.length !== TREASURY_COLUMNS.length ||
    header.some((name, index) => name !== TREASURY_COLUMNS[index])
  ) {
    return { ok: false, reason: "cabeçalho inesperado" };
  }

  const kinds = new Set(tracked.map((title) => title.kind));
  const wanted = new Set(tracked.map((title) => `${title.kind}|${title.maturity}`));
  const rows: TreasuryRow[] = [];
  let seen = 0;
  let invalid = 0;

  for (let index = 1; index < lines.length; index++) {
    const raw = lines[index].replace(/\r$/, "");
    if (raw === "") continue;
    const cells = raw.split(";");
    if (cells.length !== TREASURY_COLUMNS.length) {
      return { ok: false, reason: `linha ${index + 1} com ${cells.length} colunas` };
    }
    if (!kinds.has(cells[0])) continue;
    const maturity = parseBrDate(cells[1]);
    if (maturity === null || !wanted.has(`${cells[0]}|${maturity}`)) continue;

    seen++;
    const baseDate = parseBrDate(cells[2]);
    const buyRate = parseNumber(cells[3]);
    const sellRate = parseNumber(cells[4]);
    const buyPrice = parseNumber(cells[5]);
    const sellPrice = parseNumber(cells[6]);
    if (
      baseDate === null ||
      buyRate === null ||
      sellRate === null ||
      buyPrice === null ||
      sellPrice === null ||
      !inRange(buyRate) ||
      !inRange(sellRate)
    ) {
      invalid++;
      continue;
    }
    rows.push({ kind: cells[0], maturity, baseDate, buyRate, sellRate, buyPrice, sellPrice });
  }

  if (seen === 0) return { ok: false, reason: "nenhum título acompanhado no arquivo" };
  if (invalid / seen > MAX_INVALID_SHARE) {
    return { ok: false, reason: `${invalid} de ${seen} linhas acompanhadas inválidas` };
  }
  const latestBaseDate = rows.reduce(
    (latest, row) => (row.baseDate > latest ? row.baseDate : latest),
    "",
  );
  return { ok: true, rows, invalid, latestBaseDate };
}

/** O identificador do documento: repetir a coleta do mesmo dia é um upsert. */
export function treasuryRowId(row: Pick<TreasuryRow, "kind" | "maturity" | "baseDate">): string {
  return `${row.kind}|${row.maturity}|${row.baseDate}`;
}

/** A taxa de referência do dia: a média de compra e venda (decisão do dono, spec §7). */
export function midRate(row: { buyRate: number; sellRate: number }): number {
  return round4((row.buyRate + row.sellRate) / 2);
}

export function medianRate(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Dias corridos entre a data-base (aaaa-mm-dd) e o dia de `now`, em UTC. */
export function daysSince(baseDate: string, now: Date): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - Date.parse(`${baseDate}T00:00:00Z`)) / 86_400_000);
}

export type RateSummary = {
  /** Taxa de referência do último pregão. */
  last: number;
  /** Mediana da taxa de referência dos últimos `window` pregões. */
  median: number;
  /** last − median: mostra uma quebra de regime que a mediana, sozinha, demoraria a acompanhar. */
  divergence: number;
  baseDate: string;
  stale: boolean;
  /** Quantos pregões entraram na mediana. */
  points: number;
};

export function summarizeRate(
  series: readonly TreasurySeriesPoint[],
  now: Date,
  window = MEDIAN_WINDOW,
): RateSummary | null {
  if (series.length === 0) return null;
  const ordered = [...series].sort((a, b) => a.baseDate.localeCompare(b.baseDate)).slice(-window);
  const mids = ordered.map(midRate);
  const last = mids[mids.length - 1];
  const median = medianRate(mids) as number;
  const baseDate = ordered[ordered.length - 1].baseDate;
  return {
    last,
    median,
    divergence: round4(last - median),
    baseDate,
    stale: daysSince(baseDate, now) > STALE_AFTER_DAYS,
    points: ordered.length,
  };
}

const CATALOG_HOST = "www.tesourotransparente.gov.br";

type CatalogResource = { format?: unknown; url?: unknown; last_modified?: unknown };

/**
 * Do JSON do `package_show` (CKAN) tira o recurso CSV: a URL de download e o `last_modified`.
 * A URL só vale em https no host do Tesouro Transparente.
 */
export function parseTreasuryPackage(payload: unknown): { url: string; lastModified: string } {
  const resources = (payload as { result?: { resources?: unknown } } | null)?.result?.resources;
  if (!Array.isArray(resources)) {
    throw new Error("Catálogo do Tesouro Transparente sem a lista de recursos");
  }
  const csv = (resources as (CatalogResource | null)[]).find(
    (resource) =>
      typeof resource === "object" &&
      resource !== null &&
      String(resource.format).toUpperCase() === "CSV",
  );
  if (!csv) throw new Error("Catálogo do Tesouro Transparente sem recurso CSV");
  const url = typeof csv.url === "string" ? csv.url : "";
  const lastModified = typeof csv.last_modified === "string" ? csv.last_modified : "";
  if (!lastModified) throw new Error("Recurso CSV do Tesouro Transparente sem last_modified");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Recurso CSV do Tesouro Transparente com URL inválida");
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== CATALOG_HOST) {
    throw new Error(`Recurso CSV fora do host esperado: ${parsed.hostname}`);
  }
  return { url, lastModified };
}
