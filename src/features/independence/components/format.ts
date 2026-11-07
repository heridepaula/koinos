import { durationLabel } from "../domain/plan";
import type { IndependenceSummary } from "../domain/types";

/** "2036-09" vira "09/2036". */
export function monthSlash(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${month}/${year}`;
}

/** A linha curta do prazo: "≈ 9 anos e 10 meses (09/2036)", "Meta alcançada" ou "Sem prazo…". */
export function forecastLine(summary: IndependenceSummary): string {
  if (summary.months === null || summary.targetMonth === null) return "Sem prazo nesse ritmo";
  if (summary.months === 0) return "Meta alcançada";
  return `≈ ${durationLabel(summary.months)} (${monthSlash(summary.targetMonth)})`;
}
