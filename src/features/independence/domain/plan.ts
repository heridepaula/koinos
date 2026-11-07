import { addMonths } from "@/shared/lib/time";
import {
  EDUCATION_INFLATION,
  NOMINAL_ANNUAL_RETURN,
  REAL_MONTHLY_RATE,
  REINVESTMENT_SHARE,
  TUITIONS_PER_YEAR,
} from "./constants";
import { healthCost, healthPerpetuity, healthSteps } from "./health";
import type { IndependencePlan, IndependenceSummary, YieldSource } from "./types";

// A meta e o prazo (spec 2026-11-07-independencia-financeira-v2 §2.3 a §2.5), em reais de hoje.

const cents = (value: number) => Math.round(value * 100) / 100;

/** Anos até a idade alvo. */
const yearsToTarget = (plan: IndependencePlan) => Math.max(0, plan.targetAge - plan.currentAge);

/** Renda perpétua por mês: essencial + sazonais ÷ 12 + viagens ÷ 12. */
export function perpetualIncome(plan: IndependencePlan): number {
  return plan.essentialMonthly + plan.seasonalYearly / 12 + plan.travelYearly / 12;
}

/**
 * Os anos do fundo temporário, contados de hoje (k = 1, 2, …), com a idade do mais novo em cada
 * um: só os depois da idade alvo (k > T) e enquanto ele ainda é custeado.
 */
function fundYears(plan: IndependencePlan): { k: number; age: number }[] {
  if (plan.dependents <= 0 || plan.youngestAge === null) return [];
  const years: { k: number; age: number }[] = [];
  const target = yearsToTarget(plan);
  for (let k = target + 1; plan.youngestAge + k - 1 < plan.educationUntil; k++) {
    years.push({ k, age: plan.youngestAge + k - 1 });
  }
  return years;
}

/**
 * Fundo de escola na idade alvo, em reais de hoje: 13 mensalidades por ano, corrigidas a 8% a.a.,
 * trazidas a hoje a 9,5% a.a. e levadas à idade alvo pela taxa real.
 */
export function educationFund(plan: IndependencePlan, r: number = REAL_MONTHLY_RATE): number {
  let today = 0;
  for (const { k } of fundYears(plan)) {
    const yearly =
      TUITIONS_PER_YEAR * plan.educationMonthly * Math.pow(1 + EDUCATION_INFLATION, k - 1);
    today += yearly / Math.pow(1 + NOMINAL_ANNUAL_RETURN, k);
  }
  return today * Math.pow(1 + r, 12 * yearsToTarget(plan));
}

/** Saúde dos dependentes nos anos de custeio depois da idade alvo, descontada pela taxa real. */
export function childrenHealthFund(plan: IndependencePlan, r: number = REAL_MONTHLY_RATE): number {
  const yearlyRate = Math.pow(1 + r, 12);
  const target = yearsToTarget(plan);
  let value = 0;
  for (const { k, age } of fundYears(plan)) {
    value +=
      (12 * plan.dependents * healthCost(plan.healthLevel, age)) / Math.pow(yearlyRate, k - target);
  }
  return value;
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

/** As partes da meta (§2.3 e §2.4), sem arredondar, e o total no centavo. */
function targetParts(plan: IndependencePlan, r: number) {
  const income = perpetualIncome(plan);
  const incomeCapital = income / r;
  const titularHealth = healthPerpetuity(plan.healthLevel, plan.targetAge, r);
  const spouseAgeAtTarget = plan.spouseAge === null ? null : plan.spouseAge + yearsToTarget(plan);
  const spouseHealth =
    spouseAgeAtTarget === null ? 0 : healthPerpetuity(plan.healthLevel, spouseAgeAtTarget, r);
  const education = educationFund(plan, r);
  const childrenHealth = childrenHealthFund(plan, r);
  const perpetual = incomeCapital + titularHealth + spouseHealth;
  const temporary = education + childrenHealth;
  return {
    income,
    incomeCapital,
    titularHealth,
    spouseAgeAtTarget,
    spouseHealth,
    education,
    childrenHealth,
    perpetual,
    temporary,
    target: cents(perpetual + temporary),
  };
}

/**
 * O rendimento mensal da carteira: o DY de 12 meses ÷ 12 (é a soma de 12 distribuições mensais,
 * não um juro composto). Sem DY (nulo, zero ou negativo), o de referência da v2, 9,5% a.a.
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
 * O crescimento real do patrimônio por mês enquanto acumula: todo o rendimento volta para a
 * carteira, e a fatia que repõe a inflação (24% do rendimento) só mantém o valor. Com y o
 * rendimento do mês: (1 + y) ÷ (1 + 24% × y) − 1, perto de 76% de y.
 */
export function accumulationRate(monthlyYield: number): number {
  return (1 + monthlyYield) / (1 + REINVESTMENT_SHARE * monthlyYield) - 1;
}

/**
 * O que a meta recebe num mês (a meta × o rendimento do mês) e como se divide no usufruto: 24%
 * reinvestidos, arredondados para cima no centavo como a retenção da fruição, e o resto para
 * viver. As duas partes somam o total.
 */
export function yieldSplit(
  target: number,
  monthlyYield: number,
): { received: number; reinvestment: number; living: number } {
  const total = Math.max(0, Math.round(target * monthlyYield * 100));
  // O − 1e-9 evita que 0,24 × 10.000 = 2.400,0000001 suba um centavo.
  const kept = total === 0 ? 0 : Math.min(total, Math.ceil(total * REINVESTMENT_SHARE - 1e-9));
  return { received: total / 100, reinvestment: kept / 100, living: (total - kept) / 100 };
}

/** A meta total do plano, sem patrimônio nem prazo: o questionário a refaz a cada resposta. */
export function planTarget(plan: IndependencePlan): number {
  return targetParts(plan, REAL_MONTHLY_RATE).target;
}

/** A conta inteira da página: meta perpétua, fundo temporário, progresso e prazo. */
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
  const r = REAL_MONTHLY_RATE;
  const years = yearsToTarget(plan);
  const {
    income,
    incomeCapital,
    titularHealth,
    spouseAgeAtTarget,
    spouseHealth,
    education,
    childrenHealth,
    perpetual,
    temporary,
    target,
  } = targetParts(plan, r);
  // Na acumulação, todo o DY volta para a carteira com o aporte do bolso (§2.5); no usufruto, a
  // meta recebe o rendimento do mês e 24% dele reinvestem (§2.7).
  const { rate: monthlyRate, source } = monthlyYieldOf(input.portfolioYield);
  const growth = accumulationRate(monthlyRate);
  const received = yieldSplit(target, monthlyRate);
  // Custos mensais na idade alvo: o orçamento e a mensalidade de saúde do titular e do cônjuge.
  const costs = {
    essential: cents(plan.essentialMonthly),
    seasonal: cents(plan.seasonalYearly / 12),
    travel: cents(plan.travelYearly / 12),
    health: cents(
      healthCost(plan.healthLevel, plan.targetAge) +
        (spouseAgeAtTarget === null ? 0 : healthCost(plan.healthLevel, spouseAgeAtTarget)),
    ),
  };
  const costsTotal = cents(costs.essential + costs.seasonal + costs.travel + costs.health);
  const patrimony = koinosWealth + plan.externalWealth;
  const months = monthsToTarget({ pv: patrimony, fv: target, pmt: monthlyAporte, r: growth });
  const untilTarget = 12 * years;
  const reachesInTime = months !== null && months <= untilTarget;
  return {
    perpetualIncome: cents(income),
    incomeCapital: cents(incomeCapital),
    titularHealthNow: healthCost(plan.healthLevel, plan.targetAge),
    titularHealth: cents(titularHealth),
    spouseAgeAtTarget,
    spouseHealth: cents(spouseHealth),
    healthStepAges: healthSteps(plan.healthLevel, plan.targetAge).map((step) => step.age),
    perpetual: cents(perpetual),
    educationFund: cents(education),
    childrenHealthFund: cents(childrenHealth),
    temporary: cents(temporary),
    target,
    yieldSource: source,
    annualYield: monthlyRate * 12,
    monthlyYieldRate: monthlyRate,
    accumulationRate: growth,
    monthlyYield: received.received,
    reinvestment: received.reinvestment,
    livingIncome: received.living,
    costs,
    costsTotal,
    netLiving: cents(received.living - costsTotal),
    koinosWealth,
    externalWealth: plan.externalWealth,
    patrimony,
    progress: target > 0 ? patrimony / target : 1,
    monthlyAporte,
    realRate: r,
    months,
    targetMonth: months === null ? null : targetMonthKey(currentMonth, months),
    predictedAge: months === null ? null : plan.currentAge + Math.floor(months / 12),
    slackMonths: years > 0 && reachesInTime ? untilTarget - months : null,
    requiredAporte:
      years > 0 && !reachesInTime
        ? cents(requiredAporte({ pv: patrimony, fv: target, r: growth, m: untilTarget }))
        : null,
  };
}
