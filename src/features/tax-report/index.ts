// API pública pura da feature tax-report.
export { buildFiscalYearReport, type ReportInput } from "./domain/report";
export { formatCnpj, isValidCnpj, digitsOf, maskCnpj } from "./domain/cnpj";
export { darfDueDate } from "./domain/darf-due";
export { reportToCopyText, reportToJson, TAX_DISCLAIMER } from "./domain/export";
export { reportTickers, resolveReportYear, yearsWithActivity } from "./domain/report-view";
export { formatMoney, formatPrice, round2 } from "./domain/format";
export type {
  ApurationMonth,
  AssetFiscalPosition,
  AssetIdentity,
  AuditFinding,
  DarfMonth,
  DividendFiscalItem,
  FiscalClass,
  FiscalYearReport,
  TaxReportIdentity,
  TaxReportView,
} from "./domain/types";
