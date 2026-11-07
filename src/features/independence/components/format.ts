import { durationLabel } from "../domain/plan";
import type { IndependenceSummary } from "../domain/types";

/** "2042-09" vira "09/2042". */
export function monthSlash(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${month}/${year}`;
}

/** A linha curta do prazo: "≈ 15 anos e 10 meses, aos ~55", "Meta alcançada" ou "Sem prazo…". */
export function forecastLine(summary: IndependenceSummary): string {
  if (summary.months === null || summary.predictedAge === null) return "Sem prazo nesse ritmo";
  if (summary.months === 0) return "Meta alcançada";
  return `≈ ${durationLabel(summary.months)}, aos ~${summary.predictedAge}`;
}
