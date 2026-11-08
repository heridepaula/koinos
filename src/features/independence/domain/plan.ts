import { addMonths } from "@/shared/lib/time";
import {
  CONTINGENCY_SHARE,
  EDUCATION_INFLATION,
  GENERAL_INFLATION,
  NOMINAL_ANNUAL_RETURN,
  REINVESTMENT_SHARE,
} from "./constants";
import { healthCost, healthSteps } from "./health";
import type { IndependencePlan, IndependenceSummary, MonthlyCosts, YieldSource } from "./types";

// A meta e o prazo (spec 2026-11-07-independencia-financeira-v2 §10): os custos de um mês no
// primeiro dia da aposentadoria, a meta que os paga pelo rendimento da carteira e deixa livre o
// essencial, e o prazo com todo o rendimento reinvestido junto com o bolso.

const cents = (value: number) => Math.round(value * 100) / 100;

/** Anos até a idade alvo. */
const yearsToTarget = (plan: IndependencePlan) => Math.max(0, plan.targetAge - plan.currentAge);

/** A soma dos custos de um mês, no centavo. */
export function costsTotal(costs: MonthlyCosts): number {
  return cents(
    costs.essential +
      costs.seasonal +
      costs.travel +
      costs.health +
      costs.education +
      costs.childrenHealth,
  );
}

/**
 * A idade do mais novo na idade alvo, se ele ainda for custeado nela; null sem dependentes ou
 * quando o custeio acaba antes.
 */
function youngestCoveredAtTarget(plan: IndependencePlan): number | null {
  if (plan.dependents <= 0 || plan.youngestAge === null) return null;
  const age = plan.youngestAge + yearsToTarget(plan);
  return age < plan.educationUntil ? age : null;
}

/**
 * Os custos de um mês na idade alvo, em reais de hoje: o essencial com os 30% de imprevistos, os
 * gastos e as viagens do ano ÷ 12, o plano do titular e do cônjuge (cada um na faixa da sua idade)
 * e, quando o mais novo ainda é custeado, a escola e o plano dos dependentes pela faixa dele.
 */
export function monthlyCostsToday(plan: IndependencePlan): MonthlyCosts {
  const years = yearsToTarget(plan);
  const spouseAge = plan.spouseAge === null ? null : plan.spouseAge + years;
  const youngest = youngestCoveredAtTarget(plan);
  return {
    essential: cents(plan.essentialMonthly * (1 + CONTINGENCY_SHARE)),
    seasonal: cents(plan.seasonalYearly / 12),
    travel: cents(plan.travelYearly / 12),
    health:
      healthCost(plan.healthLevel, plan.targetAge) +
      (spouseAge === null ? 0 : healthCost(plan.healthLevel, spouseAge)),
    education: youngest === null ? 0 : cents(plan.educationMonthly),
    childrenHealth:
      youngest === null ? 0 : plan.dependents * healthCost(plan.healthLevel, youngest),
  };
}

type InflationFactors = { general: number; education: number };

/** O que leva um valor de hoje até a idade alvo: a inflação geral e a da educação. */
function inflationFactors(plan: IndependencePlan): InflationFactors {
  const years = yearsToTarget(plan);
  return {
    general: Math.pow(1 + GENERAL_INFLATION, years),
    education: Math.pow(1 + EDUCATION_INFLATION, years),
  };
}

function atFirstDay(today: MonthlyCosts, { general, education }: InflationFactors): MonthlyCosts {
  return {
    essential: cents(today.essential * general),
    seasonal: cents(today.seasonal * general),
    travel: cents(today.travel * general),
    health: cents(today.health * general),
    education: cents(today.education * education),
    childrenHealth: cents(today.childrenHealth * general),
  };
}

/**
 * Os custos de um mês no primeiro dia da aposentadoria, em reais daquele dia: os de hoje com a
 * inflação geral até a idade alvo, e a escola com a da educação.
 */
export function firstDayCosts(plan: IndependencePlan): MonthlyCosts {
  return atFirstDay(monthlyCostsToday(plan), inflationFactors(plan));
}

/**
 * Meses até o patrimônio `pv` chegar à meta `fv`, com o aporte mensal `pmt` e o crescimento `r`:
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

/** O aporte mensal que leva `pv` a `fv` em `m` meses: (FV − PV·(1+r)^m)·r ÷ ((1+r)^m − 1), piso 0. */
export function requiredAporte({
  pv,
  fv,
  r,
  m,
}: {
  pv: number;
  fv: number;
  r: number;
  m: number;
}): number {
  if (m <= 0) return Math.max(0, fv - pv);
  if (r === 0) return Math.max(0, (fv - pv) / m);
  const growth = Math.pow(1 + r, m);
  return Math.max(0, ((fv - pv * growth) * r) / (growth - 1));
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

/**
 * O rendimento mensal da carteira: o DY de 12 meses ÷ 12 (é a soma de 12 distribuições mensais,
 * não um juro composto). Sem DY (nulo, zero ou negativo), o de referência, 9,5% a.a.
 */
export function monthlyYieldOf(portfolioYield: number | null | undefined): {
  rate: number;
  source: YieldSource;
} {
  if (portfolioYield != null && Number.isFinite(portfolioYield) && portfolioYield > 0) {
    return { rate: portfolioYield / 12, source: "dy" };
  }
  return { rate: NOMINAL_ANNUAL_RETURN / 12, source: "reference" };
}

/**
 * Os 24% de `total` centavos, para cima no centavo como a retenção da fruição. O − 1e-9 evita que
 * 0,24 × 10.000 = 2.400,0000001 suba um centavo.
 */
const keptCents = (total: number) =>
  total === 0 ? 0 : Math.min(total, Math.ceil(total * REINVESTMENT_SHARE - 1e-9));

/**
 * O que a meta recebe num mês (a meta × o rendimento do mês) e como se divide no usufruto: 24%
 * reinvestidos e o resto para pagar o mês. As duas partes somam o total.
 */
export function yieldSplit(
  target: number,
  monthlyYield: number,
): { received: number; reinvestment: number; living: number } {
  const total = Math.max(0, Math.round(target * monthlyYield * 100));
  const kept = keptCents(total);
  return { received: total / 100, reinvestment: kept / 100, living: (total - kept) / 100 };
}

/**
 * A inversa de `yieldSplit`: a meta, no centavo, cujo rendimento de um mês deixa exatamente
 * `living` depois dos 24% reinvestidos. Zero sem nada a pagar.
 */
export function targetForLiving(living: number, monthlyYield: number): number {
  const need = Math.round(living * 100);
  if (need <= 0 || !(monthlyYield > 0)) return 0;
  // A parte de viver de N centavos recebidos, N − ⌈24% de N⌉, sobe 0 ou 1 centavo a cada centavo
  // recebido a mais: o primeiro N que alcança a necessidade a atinge em cheio.
  const livingOf = (received: number) => received - keptCents(received);
  let received = Math.floor(need / (1 - REINVESTMENT_SHARE));
  while (received > 0 && livingOf(received - 1) >= need) received -= 1;
  while (livingOf(received) < need) received += 1;
  // A meta que recebe esses N centavos: N ÷ y, no meio do intervalo que o arredondamento aceita.
  return Math.round(received / monthlyYield) / 100;
}

/**
 * A meta do plano, sem patrimônio nem prazo: o questionário a refaz a cada resposta. É o patrimônio
 * cujo rendimento de um mês, depois dos 24% reinvestidos, paga os custos do primeiro dia da
 * aposentadoria e deixa livre o essencial.
 */
export function planTarget(plan: IndependencePlan, portfolioYield?: number | null): number {
  return targetForLiving(costsTotal(firstDayCosts(plan)), monthlyYieldOf(portfolioYield).rate);
}

/**
 * A conta inteira da página: os custos do primeiro dia, a meta e o que ela recebe, o progresso, o
 * prazo e o aporte do bolso que chegaria à meta na idade alvo.
 */
export function independenceSummary(input: {
  plan: IndependencePlan;
  /** Patrimônio do snapshot Geral. */
  koinosWealth: number;
  /** Aporte médio mensal do bolso (`averageMonthlyAporte`). */
  monthlyAporte: number;
  /** O DY de 12 meses da carteira (fração ao ano); nulo usa o rendimento de referência. */
  portfolioYield?: number | null;
  currentMonth: string;
}): IndependenceSummary {
  const { plan, koinosWealth, monthlyAporte, currentMonth } = input;
  const years = yearsToTarget(plan);
  const factors = inflationFactors(plan);
  const costsToday = monthlyCostsToday(plan);
  const costs = atFirstDay(costsToday, factors);
  const living = costsTotal(costs);
  const otherCosts = cents(living - costs.essential);
  const { rate, source } = monthlyYieldOf(input.portfolioYield);
  const target = targetForLiving(living, rate);
  const received = yieldSplit(target, rate);
  const patrimony = koinosWealth + plan.externalWealth;
  // Na acumulação, juros compostos: todo mês os proventos (o patrimônio × o rendimento) voltam para
  // a carteira junto com o aporte do bolso, e os do mês seguinte saem maiores. A meta já está em
  // reais do primeiro dia (os custos levam a inflação até lá), então o patrimônio cresce pelo
  // rendimento inteiro, sem descontar a inflação uma segunda vez.
  const months = monthsToTarget({ pv: patrimony, fv: target, pmt: monthlyAporte, r: rate });
  const untilTarget = 12 * years;
  const reachesInTime = months !== null && months <= untilTarget;
  const required =
    years > 0 && !reachesInTime
      ? cents(requiredAporte({ pv: patrimony, fv: target, r: rate, m: untilTarget }))
      : null;
  return {
    years,
    inflationFactor: factors.general,
    educationInflationFactor: factors.education,
    costsToday,
    costs,
    otherCosts,
    titularHealthNow: healthCost(plan.healthLevel, plan.targetAge),
    spouseAgeAtTarget: plan.spouseAge === null ? null : plan.spouseAge + years,
    healthStepAges: healthSteps(plan.healthLevel, plan.targetAge).map((step) => step.age),
    target,
    yieldSource: source,
    annualYield: rate * 12,
    monthlyYieldRate: rate,
    monthlyYield: received.received,
    reinvestment: received.reinvestment,
    livingIncome: received.living,
    netLiving: cents(received.living - otherCosts),
    koinosWealth,
    externalWealth: plan.externalWealth,
    patrimony,
    progress: target > 0 ? patrimony / target : 1,
    monthlyDividendsToday: cents(patrimony * rate),
    monthlyAporte,
    months,
    targetMonth: months === null ? null : targetMonthKey(currentMonth, months),
    predictedAge: months === null ? null : plan.currentAge + Math.floor(months / 12),
    slackMonths: years > 0 && reachesInTime ? untilTarget - months : null,
    requiredAporte: required,
    extraAporte: required === null ? null : cents(Math.max(0, required - monthlyAporte)),
  };
}
