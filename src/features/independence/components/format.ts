import { formatPercent } from "@/shared/lib/format";
import { durationLabel } from "../domain/plan";
import type { IndependencePlan, IndependenceSummary } from "../domain/types";

/** "2042-09" vira "09/2042". */
export function monthSlash(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${month}/${year}`;
}

/** Verde quando chega até a idade alvo, âmbar quando passa dela, neutro sem previsão. */
export type VerdictTone = "gain" | "warn" | "neutral";

/**
 * A previsão contra a idade alvo, numa frase curta: "2 anos e 3 meses antes dos 55", "10 anos e
 * 10 meses depois dos 45", "Na idade alvo, aos 50", "Meta alcançada" ou "Sem previsão no ritmo de
 * hoje". A diferença conta os meses até a idade alvo (anos inteiros, como o domínio).
 */
export function forecastVerdict(
  plan: IndependencePlan,
  summary: IndependenceSummary,
): { tone: VerdictTone; text: string } {
  if (summary.months === 0) return { tone: "gain", text: "Meta alcançada" };
  if (summary.months === null) return { tone: "neutral", text: "Sem previsão no ritmo de hoje" };
  const gap = 12 * Math.max(0, plan.targetAge - plan.currentAge) - summary.months;
  if (gap === 0) return { tone: "gain", text: `Na idade alvo, aos ${plan.targetAge}` };
  return gap > 0
    ? { tone: "gain", text: `${durationLabel(gap)} antes dos ${plan.targetAge}` }
    : { tone: "warn", text: `${durationLabel(-gap)} depois dos ${plan.targetAge}` };
}

/** O número do card de prazo: "Aos ~55 anos", "Meta alcançada" ou "Sem previsão". */
export function forecastTitle(summary: IndependenceSummary): string {
  if (summary.months === 0) return "Meta alcançada";
  if (summary.months === null || summary.predictedAge === null) return "Sem previsão";
  return `Aos ~${summary.predictedAge} anos`;
}

/**
 * Para quando é a meta: "aos 45, daqui a 8 anos", "aos 45, daqui a 1 ano" ou, com a idade alvo
 * hoje, "aos 45, a partir de hoje".
 */
export function retirementLabel(plan: IndependencePlan, summary: IndependenceSummary): string {
  const { years } = summary;
  if (years <= 0) return `aos ${plan.targetAge}, a partir de hoje`;
  return `aos ${plan.targetAge}, daqui a ${years} ${years === 1 ? "ano" : "anos"}`;
}

/**
 * De onde vem o rendimento da conta, numa expressão: "o DY de 13,2% ao ano dos seus ativos" ou, sem
 * DY ainda, "o rendimento de referência de 9,5% ao ano".
 */
export function yieldLabel(summary: IndependenceSummary): string {
  const rate = formatPercent(summary.annualYield, 1);
  return summary.yieldSource === "dy"
    ? `o DY de ${rate} ao ano dos seus ativos`
    : `o rendimento de referência de ${rate} ao ano`;
}
