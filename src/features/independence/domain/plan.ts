import { addMonths } from "@/shared/lib/time";
import type { IndependencePlan, IndependenceSummary, YieldSource } from "./types";

// A meta e o prazo (spec 2026-11-07-independencia-financeira §2.2 e §2.3), em reais de hoje.

/** Yield mensal quando o da carteira falta ou sai da faixa. */
export const DEFAULT_MONTHLY_YIELD = 0.006;
/** Faixa de um yield mensal plausível; fora dela, vale o padrão. */
export const YIELD_BOUNDS = { min: 0.002, max: 0.015 } as const;

const cents = (value: number) => Math.round(value * 100) / 100;

/** Renda mensal líquida: custo de vida + saúde × pessoas + viagens ÷ 12. */
export function monthlyNeed(plan: IndependencePlan): number {
  return plan.livingCost + plan.healthPerPerson * plan.people + plan.travelPerYear / 12;
}

/** Renda bruta: a necessidade mais a retenção que volta para a carteira. */
export function grossIncome(need: number, retention: number): number {
  return need / (1 - retention);
}

/** A média mensal recebida (12 meses fechados) ÷ o patrimônio, ou o padrão fora da faixa. */
export function portfolioYield(
  monthlyDividends: number,
  patrimony: number,
): { value: number; source: YieldSource } {
  const value = patrimony > 0 ? monthlyDividends / patrimony : Number.NaN;
  return Number.isFinite(value) && value >= YIELD_BOUNDS.min && value <= YIELD_BOUNDS.max
    ? { value, source: "carteira" }
    : { value: DEFAULT_MONTHLY_YIELD, source: "padrao" };
}

/**
 * Meses até o patrimônio `pv` chegar à meta `fv`, com o aporte mensal `pmt` e a taxa real `r`:
 * n = ln((FV·r + PMT) ÷ (PV·r + PMT)) ÷ ln(1 + r), para cima. 0 com a meta alcançada; null quando
 * o patrimônio não cresce nesse ritmo.
 */
export function monthsToTarget({
  pv,
  fv,
  pmt,
  r,
}: {
  pv: number;
  fv: number;
  pmt: number;
  r: number;
}): number | null {
  if (pv >= fv) return 0;
  if (r === 0) return pmt > 0 ? Math.ceil((fv - pv) / pmt) : null;
  const start = pv * r + pmt;
  if (start <= 0) return null;
  const months = Math.log((fv * r + pmt) / start) / Math.log(1 + r);
  return Number.isFinite(months) ? Math.ceil(months - 1e-9) : null;
}

/** O mês (AAAA-MM) `months` meses depois do atual. */
export function targetMonthKey(currentMonth: string, months: number): string {
  return addMonths(currentMonth, months);
}

/** "9 anos e 10 meses", "1 ano", "5 meses". */
export function durationLabel(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearsText = years === 1 ? "1 ano" : `${years} anos`;
  const monthsText = rest === 1 ? "1 mês" : `${rest} meses`;
  if (years === 0) return monthsText;
  return rest === 0 ? yearsText : `${yearsText} e ${monthsText}`;
}

/** A conta inteira da página: meta, progresso e prazo. */
export function independenceSummary(input: {
  plan: IndependencePlan;
  patrimony: number;
  /** Média mensal recebida nos 12 meses fechados. */
  monthlyDividends: number;
  /** Aporte médio mensal do bolso (`averageMonthlyAporte`). */
  monthlyAporte: number;
  currentMonth: string;
}): IndependenceSummary {
  const { plan, patrimony, monthlyAporte, currentMonth } = input;
  const need = monthlyNeed(plan);
  const gross = grossIncome(need, plan.retention);
  const yieldInfo = portfolioYield(input.monthlyDividends, patrimony);
  const target = cents(gross / yieldInfo.value);
  const realRate = yieldInfo.value * (1 - plan.retention);
  const months = monthsToTarget({ pv: patrimony, fv: target, pmt: monthlyAporte, r: realRate });
  return {
    need: cents(need),
    gross: cents(gross),
    monthlyYield: yieldInfo.value,
    yieldSource: yieldInfo.source,
    target,
    patrimony,
    progress: target > 0 ? patrimony / target : 1,
    monthlyAporte,
    realRate,
    months,
    targetMonth: months === null ? null : targetMonthKey(currentMonth, months),
  };
}
