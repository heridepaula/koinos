import { describe, expect, it } from "vitest";
import { defaultPlan } from "./catalog";
import {
  CONTINGENCY_SHARE,
  EDUCATION_INFLATION,
  GENERAL_INFLATION,
  NOMINAL_ANNUAL_RETURN,
} from "./constants";
import { HEALTH_LEVELS } from "./health";
import {
  costsTotal,
  durationLabel,
  firstDayCosts,
  independenceSummary,
  monthlyCostsToday,
  monthlyYieldOf,
  monthsToTarget,
  planTarget,
  requiredAporte,
  targetForLiving,
  targetMonthKey,
  yieldSplit,
} from "./plan";
import type { IndependencePlan } from "./types";

/** O exemplo da spec v2 §2.6, com a conta de §10. */
const example: IndependencePlan = {
  currentAge: 40,
  targetAge: 45,
  externalWealth: 0,
  essentialMonthly: 10_000,
  seasonalYearly: 12_000,
  travelYearly: 24_000,
  spouseAge: 38,
  dependents: 2,
  youngestAge: 6,
  educationMonthly: 2_500,
  educationUntil: 24,
  healthLevel: "conforto",
};

const plan = (patch: Partial<IndependencePlan> = {}): IndependencePlan => ({
  ...example,
  ...patch,
});

/** O DY do exemplo: 12% ao ano, 1% ao mês. */
const DY = 0.12;

const summaryOf = (
  p: IndependencePlan,
  koinosWealth = 1_000_000,
  monthlyAporte = 8_000,
  portfolioYield: number | null = DY,
) =>
  independenceSummary({
    plan: p,
    koinosWealth,
    monthlyAporte,
    portfolioYield,
    currentMonth: "2026-11",
  });

/** Sorteio repetível (mulberry32), para os planos aleatórios. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomPlan(random: () => number): IndependencePlan {
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const money = (max: number) => Math.round(random() * max * 100) / 100;
  const currentAge = int(18, 70);
  const dependents = random() < 0.5 ? 0 : int(1, 4);
  return {
    currentAge,
    targetAge: int(currentAge, 80),
    externalWealth: 0,
    essentialMonthly: money(40_000),
    seasonalYearly: money(60_000),
    travelYearly: money(100_000),
    spouseAge: random() < 0.5 ? null : int(18, 80),
    dependents,
    youngestAge: dependents > 0 ? int(0, 25) : null,
    educationMonthly: money(10_000),
    educationUntil: random() < 0.5 ? 18 : 24,
    healthLevel: HEALTH_LEVELS[int(0, HEALTH_LEVELS.length - 1)]!,
  };
}

describe("o exemplo (§10)", () => {
  const summary = summaryOf(example);

  it("os custos de um mês aos 45, em reais de hoje", () => {
    expect(summary.costsToday).toEqual({
      essential: 13_000, // 10.000 + 30% de imprevistos
      seasonal: 1_000,
      travel: 2_000,
      health: 1_285, // 735 do titular aos 45 + 550 do cônjuge aos 43
      education: 2_500, // o mais novo terá 11
      childrenHealth: 580, // 2 × 290, a faixa do mais novo
    });
    expect(summary.titularHealthNow).toBe(735);
    expect(summary.spouseAgeAtTarget).toBe(43);
    expect(summary.healthStepAges).toEqual([49, 54, 59]);
  });

  it("no primeiro dia: 5 anos de inflação, e a escola pela da educação", () => {
    expect(GENERAL_INFLATION).toBeCloseTo(0.04378, 5);
    expect(summary.years).toBe(5);
    expect(summary.inflationFactor).toBeCloseTo(Math.pow(1 + GENERAL_INFLATION, 5), 12);
    expect(summary.educationInflationFactor).toBeCloseTo(Math.pow(1 + EDUCATION_INFLATION, 5), 12);
    expect(summary.costs).toEqual({
      essential: 16_106.13,
      seasonal: 1_238.93,
      travel: 2_477.87,
      health: 1_592.03,
      education: 3_673.32,
      childrenHealth: 718.58,
    });
    expect(summary.otherCosts).toBe(9_700.73);
  });

  it("a meta recebe os custos do primeiro dia e os 24%, e sobra exatamente o essencial", () => {
    expect(summary.target).toBe(3_395_640);
    expect(summary.monthlyYield).toBe(33_956.4);
    expect(summary.reinvestment).toBe(8_149.54);
    expect(summary.livingIncome).toBe(25_806.86);
    expect(summary.livingIncome).toBe(costsTotal(summary.costs));
    expect(summary.netLiving).toBe(16_106.13);
    expect(summary.netLiving).toBe(summary.costs.essential);
  });

  it("o prazo com o aporte de hoje, a idade e o aporte a mais para parar aos 45", () => {
    expect(summary.months).toBe(86);
    expect(durationLabel(summary.months!)).toBe("7 anos e 2 meses");
    expect(summary.targetMonth).toBe("2034-01");
    expect(summary.predictedAge).toBe(47);
    expect(summary.slackMonths).toBeNull();
    expect(summary.requiredAporte).toBe(19_333.29);
    expect(summary.extraAporte).toBe(11_333.29);
  });

  it("planTarget é a meta do resumo, sem patrimônio nem prazo", () => {
    expect(planTarget(example, DY)).toBe(summary.target);
    const solo = plan({ spouseAge: null, dependents: 0, youngestAge: null });
    expect(planTarget(solo, DY)).toBe(summaryOf(solo, 0, 0).target);
  });
});

describe("os custos do mês", () => {
  it("escola e saúde dos dependentes só com o mais novo custeado na idade alvo", () => {
    const none = { education: 0, childrenHealth: 0 };
    // Aos 60, o mais novo terá 26: passou dos 24.
    expect(monthlyCostsToday(plan({ targetAge: 60 }))).toMatchObject(none);
    expect(monthlyCostsToday(plan({ dependents: 0, youngestAge: null }))).toMatchObject(none);
    // Com 13 hoje, terá 18 aos 45: fora do custeio até os 18, dentro do até os 24.
    expect(monthlyCostsToday(plan({ youngestAge: 13, educationUntil: 18 }))).toMatchObject(none);
    expect(monthlyCostsToday(plan({ youngestAge: 13 }))).toMatchObject({
      education: 2_500,
      childrenHealth: 580,
    });
  });

  it("cada um na faixa da sua idade na idade alvo; sem plano, zero", () => {
    // Titular aos 60 (1.725) e cônjuge aos 58 (1.200).
    expect(monthlyCostsToday(plan({ targetAge: 60 })).health).toBe(2_925);
    expect(monthlyCostsToday(plan({ spouseAge: null })).health).toBe(735);
    expect(monthlyCostsToday(plan({ healthLevel: "nenhum" }))).toMatchObject({
      health: 0,
      childrenHealth: 0,
    });
  });

  it("o essencial leva os 30% de imprevistos", () => {
    expect(CONTINGENCY_SHARE).toBe(0.3);
    expect(monthlyCostsToday(plan({ essentialMonthly: 11_000 })).essential).toBe(14_300);
  });

  it("na idade alvo hoje, o primeiro dia é hoje: sem inflação", () => {
    const now = plan({ currentAge: 45, targetAge: 45 });
    expect(firstDayCosts(now)).toEqual(monthlyCostsToday(now));
  });

  it("a escola corrige pela inflação da educação, e o resto pela geral", () => {
    const costs = firstDayCosts(example);
    expect(costs.education).toBeCloseTo(2_500 * Math.pow(1 + EDUCATION_INFLATION, 5), 2);
    expect(costs.travel).toBeCloseTo(2_000 * Math.pow(1 + GENERAL_INFLATION, 5), 2);
  });
});

describe("a meta pelo rendimento", () => {
  it("targetForLiving é a inversa de yieldSplit, no centavo", () => {
    expect(targetForLiving(7_600, 0.01)).toBe(1_000_000);
    expect(yieldSplit(1_000_000, 0.01).living).toBe(7_600);
    expect(targetForLiving(0.76, 0.01)).toBe(100);
    expect(targetForLiving(0, 0.01)).toBe(0);
    expect(targetForLiving(100, 0)).toBe(0);
  });

  it("sobra exatamente o essencial em 500 planos e DYs sorteados", () => {
    const random = seeded(20_261_107);
    for (let i = 0; i < 500; i++) {
      const summary = summaryOf(randomPlan(random), 0, 0, 0.04 + random() * 0.16);
      expect(summary.livingIncome).toBe(costsTotal(summary.costs));
      expect(summary.netLiving).toBe(summary.costs.essential);
      expect(summary.reinvestment + summary.livingIncome).toBeCloseTo(summary.monthlyYield, 6);
    }
  });

  it("DY maior, meta menor; sem DY, o rendimento de referência de 9,5% a.a.", () => {
    expect(summaryOf(example, 1_000_000, 8_000, 0.14).target).toBe(2_910_548.57);
    expect(summaryOf(example, 1_000_000, 8_000, 0.1).target).toBe(4_074_768);
    const reference = summaryOf(example, 1_000_000, 8_000, null);
    expect(reference.target).toBe(4_289_229.47);
    expect(reference.target).toBe(planTarget(example, null));
  });

  it("a meta não depende do patrimônio nem do aporte", () => {
    expect(summaryOf(example, 0, 0).target).toBe(summaryOf(example).target);
    expect(summaryOf(example, 9_000_000, 50_000).target).toBe(summaryOf(example).target);
  });
});

describe("rendimento: o DY da carteira", () => {
  it("o DY ÷ 12 é o rendimento do mês; sem DY, o de referência de 9,5% a.a.", () => {
    expect(monthlyYieldOf(0.12)).toEqual({ rate: 0.01, source: "dy" });
    for (const missing of [null, undefined, 0, -0.05, Number.NaN]) {
      expect(monthlyYieldOf(missing)).toEqual({
        rate: NOMINAL_ANNUAL_RETURN / 12,
        source: "reference",
      });
    }
  });

  it("o resumo diz de onde veio o rendimento", () => {
    const withDy = summaryOf(example, 1_000_000, 8_000, 0.132);
    expect(withDy.yieldSource).toBe("dy");
    expect(withDy.annualYield).toBeCloseTo(0.132, 12);
    expect(withDy.monthlyYieldRate).toBeCloseTo(0.011, 12);
    const reference = summaryOf(example, 1_000_000, 8_000, null);
    expect(reference.yieldSource).toBe("reference");
    expect(reference.annualYield).toBeCloseTo(NOMINAL_ANNUAL_RETURN, 12);
  });
});

describe("o prazo: juros compostos com o DY reinvestido", () => {
  it("bate com a simulação mês a mês, e os proventos crescem todo mês", () => {
    const summary = summaryOf(example);
    expect(summary.monthlyDividendsToday).toBe(10_000);
    let patrimony = 1_000_000;
    let previous = 0;
    let months = 0;
    while (patrimony < summary.target) {
      const dividends = patrimony * summary.monthlyYieldRate;
      expect(dividends).toBeGreaterThan(previous);
      previous = dividends;
      // Os proventos voltam para a carteira junto com o aporte do bolso.
      patrimony += dividends + 8_000;
      months += 1;
    }
    expect(summary.months).toBe(months);
    expect(months).toBe(86);
    // No mês da meta, os proventos já passam do que ela recebe.
    expect(patrimony * summary.monthlyYieldRate).toBeGreaterThanOrEqual(summary.monthlyYield);
  });

  it("DY maior, prazo menor", () => {
    const months = (dy: number) => summaryOf(example, 1_000_000, 8_000, dy).months!;
    expect(months(0.14)).toBeLessThan(months(0.12));
    expect(months(0.12)).toBeLessThan(months(0.1));
  });

  it("o aporte necessário leva o patrimônio à meta na idade alvo, mês a mês", () => {
    const summary = summaryOf(example);
    let patrimony = 1_000_000;
    for (let month = 0; month < 60; month++) {
      patrimony += patrimony * summary.monthlyYieldRate + summary.requiredAporte!;
    }
    expect(patrimony).toBeCloseTo(summary.target, -1);
    expect(summary.extraAporte).toBeCloseTo(summary.requiredAporte! - 8_000, 2);
  });

  it("com o aporte de hoje bastando, nada a mais: a folga até a idade alvo", () => {
    const summary = summaryOf(plan({ targetAge: 60 }));
    expect(summary.months).toBe(132);
    expect(summary.slackMonths).toBe(108);
    expect(summary.requiredAporte).toBeNull();
    expect(summary.extraAporte).toBeNull();
  });
});

describe("o que a meta recebe por mês (§2.7)", () => {
  it("as duas partes somam o total, e os 24% arredondam para cima no centavo", () => {
    expect(yieldSplit(1_000_000, 0.01)).toEqual({
      received: 10_000,
      reinvestment: 2_400,
      living: 7_600,
    });
    expect(yieldSplit(1_000_001, 0.01)).toEqual({
      received: 10_000.01,
      reinvestment: 2_400.01,
      living: 7_600,
    });
    expect(yieldSplit(100.03, 0.01)).toEqual({ received: 1, reinvestment: 0.24, living: 0.76 });
  });

  it("meta zero não recebe nada, e sem o -0", () => {
    expect(yieldSplit(0, 0.01)).toEqual({ received: 0, reinvestment: 0, living: 0 });
    const empty = summaryOf({ ...defaultPlan(), healthLevel: "nenhum" }, 0, 0);
    expect(empty.target).toBe(0);
    expect(empty.monthlyYield).toBe(0);
    expect(empty.reinvestment).toBe(0);
    expect(empty.livingIncome).toBe(0);
    expect(empty.netLiving).toBe(0);
    // A saúde Conforto do padrão já pede patrimônio.
    expect(summaryOf(defaultPlan(), 0, 0).target).toBeGreaterThan(0);
  });
});

describe("patrimônio e progresso", () => {
  it("soma o patrimônio externo ao do Koinos", () => {
    const summary = summaryOf(plan({ externalWealth: 500_000 }));
    expect(summary.patrimony).toBe(1_500_000);
    expect(summary.progress).toBeCloseTo(1_500_000 / 3_395_640, 10);
    expect(summary.monthlyDividendsToday).toBe(15_000);
  });

  it("acima da meta: prazo 0, progresso inteiro e folga até a idade alvo", () => {
    const summary = summaryOf(example, 4_000_000);
    expect(summary.months).toBe(0);
    expect(summary.progress).toBeGreaterThan(1);
    expect(summary.slackMonths).toBe(60);
    expect(summary.requiredAporte).toBeNull();
    expect(summary.extraAporte).toBeNull();
  });

  it("com o prazo antes da idade alvo, mostra a folga", () => {
    const summary = summaryOf(plan({ targetAge: 70, spouseAge: null, dependents: 0 }), 1_000_000);
    expect(summary.months).not.toBeNull();
    expect(summary.slackMonths).toBe(12 * 30 - summary.months!);
    expect(summary.requiredAporte).toBeNull();
  });

  it("sem prazo nesse ritmo: tudo nulo, menos o aporte necessário", () => {
    const summary = summaryOf(example, 0, 0);
    expect(summary.months).toBeNull();
    expect(summary.targetMonth).toBeNull();
    expect(summary.predictedAge).toBeNull();
    expect(summary.requiredAporte).toBeGreaterThan(0);
    expect(summary.extraAporte).toBe(summary.requiredAporte);
  });

  it("idade alvo hoje: sem folga nem aporte necessário", () => {
    const summary = summaryOf(plan({ currentAge: 45, targetAge: 45 }));
    expect(summary.slackMonths).toBeNull();
    expect(summary.requiredAporte).toBeNull();
    expect(summary.extraAporte).toBeNull();
  });
});

describe("monthsToTarget", () => {
  it("patrimônio na meta ou acima: prazo 0", () => {
    expect(monthsToTarget({ pv: 2_000_000, fv: 1_785_714.29, pmt: 0, r: 0.005 })).toBe(0);
  });

  it("taxa zero com aporte: a diferença ÷ o aporte, para cima", () => {
    expect(monthsToTarget({ pv: 0, fv: 10_000, pmt: 3_000, r: 0 })).toBe(4);
  });

  it("taxa zero sem aporte: sem prazo", () => {
    expect(monthsToTarget({ pv: 1_000, fv: 10_000, pmt: 0, r: 0 })).toBeNull();
  });

  it("sem aporte, só a taxa faz o patrimônio crescer", () => {
    expect(monthsToTarget({ pv: 1_000, fv: 2_000, pmt: 0, r: 0.01 })).toBe(70);
  });

  it("sem patrimônio e sem aporte: sem prazo", () => {
    expect(monthsToTarget({ pv: 0, fv: 10_000, pmt: 0, r: 0.005 })).toBeNull();
  });
});

describe("requiredAporte", () => {
  it("o exemplo: R$ 19.333,29 por mês em 60 meses a 1% ao mês", () => {
    expect(requiredAporte({ pv: 1_000_000, fv: 3_395_640, r: 0.01, m: 60 })).toBeCloseTo(
      19_333.29,
      1,
    );
  });

  it("piso 0 quando o patrimônio já cresce até a meta sozinho", () => {
    expect(requiredAporte({ pv: 1_000_000, fv: 1_100_000, r: 0.004, m: 60 })).toBe(0);
  });

  it("taxa zero: a diferença ÷ os meses", () => {
    expect(requiredAporte({ pv: 0, fv: 12_000, r: 0, m: 12 })).toBe(1_000);
  });
});

describe("targetMonthKey e durationLabel", () => {
  it("soma os meses ao mês atual, virando o ano", () => {
    expect(targetMonthKey("2026-11", 190)).toBe("2042-09");
    expect(targetMonthKey("2026-11", 2)).toBe("2027-01");
  });

  it.each([
    [190, "15 anos e 10 meses"],
    [12, "1 ano"],
    [13, "1 ano e 1 mês"],
    [5, "5 meses"],
    [1, "1 mês"],
    [0, "0 meses"],
  ])("%i meses: %s", (months, label) => {
    expect(durationLabel(months)).toBe(label);
  });
});
