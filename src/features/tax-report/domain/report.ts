import { replayLedger, type DividendEntry } from "@/features/transactions";
import { auditReport } from "./audit";
import { apureMonthly } from "./monthly-apuration";
import type { AssetIdentity, FiscalClass, FiscalYearReport } from "./types";
import { groupYearDividends } from "./year-dividends";
import { buildAssetPositions, type TaxLedgerEntry } from "./year-end-positions";

export type ReportInput = {
  year: number;
  entries: readonly TaxLedgerEntry[];
  dividends: readonly DividendEntry[];
  assetClasses: ReadonlyMap<string, FiscalClass>;
  identities: ReadonlyMap<string, AssetIdentity>;
  /** Saldo de prejuízo informado pelo dono; ausente = zero e achado `SALDO_PREJUIZO_NAO_INFORMADO`. */
  openingLoss: Record<FiscalClass, number> | null;
};

/** Junta posições em 31/12, proventos por ficha, apuração mensal e achados do ano declarado. */
export function buildFiscalYearReport(input: ReportInput): FiscalYearReport {
  const { year, entries, dividends, assetClasses, identities } = input;
  const classOf = (t: string) => assetClasses.get(t) ?? null;
  const cnpjOf = (t: string) => identities.get(t)?.cnpj ?? null;
  const openingLoss = input.openingLoss ?? { FII: 0, ACAO: 0 };

  const positions = buildAssetPositions({ year, entries, assetClasses, identities });
  const yearDividends = groupYearDividends({ year, dividends, cnpjOf, classOf });

  const { sales } = replayLedger(entries);
  const unitPrice = new Map(entries.map((e) => [e.id, e.unitPrice]));
  // A apuração corre do livro-razão inteiro até dezembro do ano, para o saldo chegar certo;
  // o relatório mostra só os meses do ano.
  const full = apureMonthly({
    sales,
    unitPriceOf: (id) => unitPrice.get(id) ?? 0,
    classOf,
    openingLoss,
    throughMonth: `${year}-12`,
  });
  const inYear = (month: string) => month.startsWith(`${year}-`);
  const months = full.months.filter((m) => inYear(m.month));
  const darf = full.darf.filter((d) => inYear(d.month));

  const findings = auditReport({
    year,
    positions,
    dividends: yearDividends,
    rawDividends: dividends,
    entries,
    months,
    openingLossInformed: input.openingLoss !== null,
    classOf,
    cnpjOf,
  });

  return {
    year,
    positions,
    exempt: yearDividends.exempt,
    exclusive: yearDividends.exclusive,
    unclassified: yearDividends.unclassified,
    apuration: { months, darf, openingLoss },
    closingLoss: full.closingLoss,
    findings,
  };
}
