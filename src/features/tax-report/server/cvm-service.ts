import "server-only";
import { unzipSync } from "fflate";
import { getAssetClasses, readAssetIdentities, writeCvmCnpjs } from "@/features/market-data/server";
import {
  listDividendTickers,
  listTradedTickersWithFirstDate,
} from "@/features/transactions/server";
import { withLock } from "@/shared/db/lock";
import { traced } from "@/shared/lib/tracing";
import {
  decodeCvm,
  parseCvmCsv,
  resolveCnpjs,
  stockCnpjByTicker,
  type CvmFund,
} from "../domain/cvm-cnpj";

const BASE = "https://dados.cvm.gov.br/dados";
const UA = { "User-Agent": "Koinos/1.0" };
const STOCK_HEADER = ["CNPJ_Companhia", "Codigo_Negociacao", "Nome_Empresarial"];
const FUND_HEADER = ["CNPJ_Fundo_Classe", "Nome_Fundo_Classe", "Codigo_ISIN"];

export type CnpjSyncResult = { updated: number; unmatched: string[] };

/** Baixa o ZIP e lê um CSV de dentro; null se o arquivo do ano ainda não existe (404). */
async function fetchZipCsv(url: string, entry: string): Promise<Record<string, string>[] | null> {
  const response = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25_000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`CVM ${url}: HTTP ${response.status}`);
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()), {
    filter: (file) => file.name === entry,
  });
  const bytes = files[entry];
  if (!bytes) throw new Error(`CVM ${url}: arquivo ${entry} ausente`);
  return parseCvmCsv(decodeCvm(bytes));
}

/** O arquivo do ano corrente; em janeiro ele pode não existir ainda, e vale o do ano anterior. */
async function fetchYearCsv(
  path: (year: number) => { url: string; entry: string },
  year: number,
): Promise<Record<string, string>[]> {
  for (const y of [year, year - 1]) {
    const { url, entry } = path(y);
    const rows = await fetchZipCsv(url, entry);
    if (rows) return rows;
  }
  throw new Error(`CVM ${path(year).url}: sem arquivo em ${year} nem em ${year - 1}`);
}

function requireColumns(rows: Record<string, string>[], columns: string[], label: string) {
  if (rows.length === 0 || columns.some((column) => !(column in rows[0]))) {
    throw new Error(`CVM ${label}: cabeçalho inesperado`);
  }
}

async function run(now: Date): Promise<CnpjSyncResult> {
  const year = now.getUTCFullYear();
  // Ações e FIIs vêm antes de qualquer escrita: um erro de rede ou de cabeçalho não grava nada.
  const [stockRows, fundRows] = await Promise.all([
    fetchYearCsv(
      (y) => ({
        url: `${BASE}/CIA_ABERTA/DOC/FCA/DADOS/fca_cia_aberta_${y}.zip`,
        entry: `fca_cia_aberta_valor_mobiliario_${y}.csv`,
      }),
      year,
    ),
    fetchYearCsv(
      (y) => ({
        url: `${BASE}/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_${y}.zip`,
        entry: `inf_mensal_fii_geral_${y}.csv`,
      }),
      year,
    ),
  ]);
  requireColumns(stockRows, STOCK_HEADER, "FCA valor mobiliário");
  requireColumns(fundRows, FUND_HEADER, "informe mensal de FII");

  const funds: CvmFund[] = fundRows.map((row) => ({
    cnpj: row.CNPJ_Fundo_Classe,
    name: row.Nome_Fundo_Classe,
    isin: row.Codigo_ISIN,
  }));

  // Só os ativos que alguma carteira tem ou teve (negociados ou com provento).
  const [traded, dividendTickers] = await Promise.all([
    listTradedTickersWithFirstDate(),
    listDividendTickers(),
  ]);
  const tickers = [...new Set([...traded.map((item) => item.ticker), ...dividendTickers])];
  const [classes, identities] = await Promise.all([
    getAssetClasses(tickers),
    readAssetIdentities(tickers),
  ]);
  const targets = tickers.flatMap((ticker) => {
    const assetClass = classes.get(ticker);
    return assetClass ? [{ ticker, assetClass, name: identities.get(ticker)?.name ?? null }] : [];
  });

  const { matched, unmatched } = resolveCnpjs(targets, stockCnpjByTicker(stockRows), funds);
  const updated = await writeCvmCnpjs(matched, now);
  return { updated, unmatched };
}

/**
 * Sincroniza o CNPJ dos ativos pelos dados abertos da CVM (spec 2026-11-16-relatorio-ir-design.md,
 * §4): ações pelo FCA, FIIs pelo prefixo do ISIN no informe mensal. Nunca sobrescreve um CNPJ
 * digitado pelo dono. Ocupado por outra execução, responde zerado.
 */
export const syncCnpjs = traced(
  "cron.refresh-cnpj",
  async (now: Date = new Date()): Promise<CnpjSyncResult> =>
    (await withLock("cnpj", 120_000, () => run(now))) ?? { updated: 0, unmatched: [] },
  (result) => ({
    "koinos.cnpj.updated": result.updated,
    "koinos.cnpj.unmatched": result.unmatched.length,
  }),
);
