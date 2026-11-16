// API pública de servidor da feature tax-report.
import "server-only";

export { syncCnpjs, type CnpjSyncResult } from "./server/cvm-service";
export { getTaxReportView } from "./server/tax-report-view";
