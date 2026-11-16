import "server-only";
import { cache } from "react";
import { getTenant, type Tenant } from "@/features/auth/server";
import { getAssetClasses, readAssetIdentities } from "@/features/market-data/server";
import { listDividendsOf, listTransactionsOf } from "@/features/transactions/server";
import { traced } from "@/shared/lib/tracing";
import { narrativeCodes, narrativeReferences, narrativesView } from "../domain/narrative";
import { buildFiscalYearReport } from "../domain/report";
import { reportTickers, yearsWithActivity } from "../domain/report-view";
import type { AssetIdentity, FiscalClass, TaxReportIdentity, TaxReportView } from "../domain/types";
import { findNarratives } from "./narrative-repo";
import { findOpeningLoss } from "./tax-loss-repo";

const NO_IDENTITY: AssetIdentity = {
  name: null,
  legalName: null,
  cnpj: null,
  cnpjSource: null,
  subType: null,
};

/**
 * Monta o relatório de IR do ano para um tenant, sem cache e sem os textos da IA. A tela passa por
 * `getTaxReportView`; a geração dos textos (Server Action) chama esta direto, para ler os dados do
 * momento. Lê o livro-razão, os proventos, as classes, as identidades dos ativos e o saldo de
 * prejuízo anterior ao livro-razão.
 */
export async function loadTaxReport(tenant: Tenant, year: number) {
  const [entries, dividends, openingLoss] = await Promise.all([
    listTransactionsOf(tenant),
    listDividendsOf(tenant),
    findOpeningLoss(tenant.portfolioId),
  ]);
  // Os tickers vêm do livro-razão e dos proventos: há FIIs que só aparecem por proventos.
  const tickers = reportTickers(entries, dividends);
  const [classes, stored] = await Promise.all([
    getAssetClasses(tickers),
    readAssetIdentities(tickers),
  ]);
  const assetClasses = new Map<string, FiscalClass>(
    [...classes].flatMap(([ticker, assetClass]) => (assetClass ? [[ticker, assetClass]] : [])),
  );
  const identities = new Map<string, AssetIdentity>(
    tickers.map((ticker) => [ticker, stored.get(ticker) ?? NO_IDENTITY]),
  );
  const report = buildFiscalYearReport({
    year,
    entries,
    dividends,
    assetClasses,
    identities,
    openingLoss,
  });
  const identityList: TaxReportIdentity[] = [...tickers]
    .sort()
    .map((ticker) => ({ ticker, ...identities.get(ticker)! }));
  return {
    report,
    identities: identityList,
    years: yearsWithActivity(entries, dividends),
  };
}

/**
 * O relatório de IR do ano para o usuário logado (spec 2026-11-16-relatorio-ir-design.md): o
 * `FiscalYearReport` determinístico e os textos do Gemini já guardados. A tela só lê: nunca gera
 * texto. DTO sem ids internos.
 */
export const getTaxReportView = cache(
  traced(
    "view.tax-report",
    async (year: number): Promise<TaxReportView> => {
      const tenant = await getTenant(); // chama connection(): só em tempo de requisição
      const [{ report, identities, years }, stored] = await Promise.all([
        loadTaxReport(tenant, year),
        findNarratives(tenant.portfolioId, year),
      ]);
      const narratives = narrativesView(
        stored,
        narrativeReferences(report.positions),
        narrativeCodes(report),
      );
      return { year, years, report, identities, narratives };
    },
    (view) => ({
      "koinos.tax.positions": view.report.positions.length,
      "koinos.tax.findings": view.report.findings.length,
    }),
  ),
);
