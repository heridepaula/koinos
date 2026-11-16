// API pública pura da feature tax-report.
export { buildFiscalYearReport, type ReportInput } from "./domain/report";
export { formatCnpj, isValidCnpj, digitsOf } from "./domain/cnpj";
export { reportTickers, yearsWithActivity } from "./domain/report-view";
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
