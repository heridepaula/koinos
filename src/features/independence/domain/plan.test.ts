import { describe, expect, it } from "vitest";
import { defaultPlan } from "./catalog";
import { NOMINAL_ANNUAL_RETURN, REAL_MONTHLY_RATE, REINVESTMENT_SHARE } from "./constants";
import {
  accumulationRate,
  childrenHealthFund,
  durationLabel,
  educationFund,
  independenceSummary,
  monthlyYieldOf,
  monthsToTarget,
  perpetualIncome,
  planTarget,
  requiredAporte,
  targetMonthKey,
  yieldSplit,
} from "./plan";
import type { IndependencePlan } from "./types";

/** O exemplo da spec v2 §2.6. */
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

/**
 * O DY (ao ano) que faz o patrimônio crescer os 0,4% a.m. reais da v2: com ele valem os números do
 * exemplo da spec (218 meses, R$ 57.211,73). É a inversa de `accumulationRate`.
 */
const V2_YIELD = (12 * REAL_MONTHLY_RATE) / (1 - REINVESTMENT_SHARE * (1 + REAL_MONTHLY_RATE));

const summaryOf = (
  p: IndependencePlan,
  koinosWealth = 1_000_000,
  monthlyAporte = 8_000,
  portfolioYield: number | null = V2_YIELD,
) =>
  independenceSummary({
    plan: p,
    koinosWealth,
    monthlyAporte,
    portfolioYield,
    currentMonth: "2026-11",
  });

describe("o exemplo da spec v2", () => {
  const summary = summaryOf(example);

  it("meta perpétua: renda ÷ r, titular e cônjuge em degraus", () => {
    expect(summary.perpetualIncome).toBe(16_000);
    expect(summary.incomeCapital).toBe(4_000_000);
    expect(summary.titularHealthNow).toBe(735);
    expect(summary.healthStepAges).toEqual([49, 54, 59]);
    expect(summary.titularHealth).toBe(332_777.82);
    expect(summary.spouseAgeAtTarget).toBe(43);
    expect(summary.spouseHealth).toBe(316_999);
    expect(summary.perpetual).toBe(4_649_776.83);
  });

  it("fundo temporário: escola e saúde dos filhos depois da idade alvo", () => {
    expect(summary.educationFund).toBe(421_812.65);
    expect(summary.childrenHealthFund).toBe(70_007.47);
    expect(summary.temporary).toBe(491_820.11);
  });

  it("meta total, prazo, idade prevista e aporte necessário", () => {
    expect(summary.target).toBe(5_141_596.94);
    expect(summary.months).toBe(218);
    expect(durationLabel(summary.months!)).toBe("18 anos e 2 meses");
    expect(summary.targetMonth).toBe("2045-01");
    expect(summary.predictedAge).toBe(58);
    expect(summary.slackMonths).toBeNull();
    expect(summary.requiredAporte).toBe(57_211.73);
  });

  it("planTarget é a meta do resumo, sem patrimônio nem prazo", () => {
    expect(planTarget(example)).toBe(summary.target);
    expect(planTarget(plan({ dependents: 0, youngestAge: null }))).toBe(
      summaryOf(plan({ dependents: 0, youngestAge: null }), 0, 0).target,
    );
  });

  it("o V2_YIELD dá mesmo os 0,4% a.m. reais da v2", () => {
    expect(accumulationRate(V2_YIELD / 12)).toBeCloseTo(REAL_MONTHLY_RATE, 12);
    expect(summary.accumulationRate).toBeCloseTo(REAL_MONTHLY_RATE, 12);
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

  it("a meta e as partes dela não dependem do rendimento", () => {
    expect(summaryOf(example, 1_000_000, 8_000, 0.2).target).toBe(
      summaryOf(example, 1_000_000, 8_000, null).target,
    );
  });
});

describe("crescimento na acumulação", () => {
  it("(1 + y) ÷ (1 + 24% × y) − 1: perto de 76% do rendimento", () => {
    expect(accumulationRate(0.01)).toBeCloseTo(1.01 / 1.0024 - 1, 12);
    expect(accumulationRate(0.01)).toBeCloseTo(0.0076, 4);
    expect(accumulationRate(0)).toBe(0);
  });

  it("o prazo bate com a simulação mês a mês: o DY todo reinvestido mais o aporte do bolso", () => {
    const summary = summaryOf(example, 1_000_000, 8_000, 0.12);
    const growth = accumulationRate(0.12 / 12);
    let patrimony = 1_000_000;
    let months = 0;
    while (patrimony < summary.target) {
      patrimony = patrimony * (1 + growth) + 8_000;
      months += 1;
    }
    expect(summary.accumulationRate).toBeCloseTo(growth, 12);
    expect(summary.months).toBe(months);
    expect(months).toBe(147);
  });

  it("DY maior, prazo menor; e menor que com os 0,4% reais de antes", () => {
    const months = (dy: number) => summaryOf(example, 1_000_000, 8_000, dy).months!;
    expect(months(0.14)).toBeLessThan(months(0.1));
    expect(months(0.12)).toBeLessThan(summaryOf(example).months!);
  });

  it("o aporte necessário leva o patrimônio à meta na idade alvo, com o mesmo crescimento", () => {
    const summary = summaryOf(example, 1_000_000, 8_000, 0.12);
    const growth = Math.pow(1 + summary.accumulationRate, 60);
    const reached =
      1_000_000 * growth + (summary.requiredAporte! * (growth - 1)) / summary.accumulationRate;
    expect(reached).toBeCloseTo(summary.target, -1);
  });
});

describe("o que a meta recebe por mês (§2.7)", () => {
  it("meta × rendimento do mês, 24% reinvestidos e o resto para viver", () => {
    const summary = summaryOf(example, 1_000_000, 8_000, 0.12); // 1% a.m.
    expect(summary.monthlyYield).toBe(51_415.97);
    expect(summary.reinvestment).toBe(12_339.84);
    expect(summary.livingIncome).toBe(39_076.13);
  });

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
    const empty = summaryOf({ ...defaultPlan(), healthLevel: "nenhum" }, 0, 0, 0.12);
    expect(empty.target).toBe(0);
    expect(empty.monthlyYield).toBe(0);
    expect(empty.reinvestment).toBe(0);
    expect(empty.livingIncome).toBe(0);
    // A saúde Conforto do padrão já pede patrimônio.
    expect(summaryOf(defaultPlan(), 0, 0).target).toBeGreaterThan(0);
  });
});

describe("fundo temporário", () => {
  it("é zero sem dependentes", () => {
    const p = plan({ dependents: 0, youngestAge: null });
    expect(educationFund(p)).toBe(0);
    expect(childrenHealthFund(p)).toBe(0);
  });

  it("é zero quando a idade alvo vem depois do fim do custeio", () => {
    // O mais novo tem 6; com 20 anos até a idade alvo, ele já passou dos 24.
    const p = plan({ targetAge: 60 });
    expect(educationFund(p)).toBe(0);
    expect(childrenHealthFund(p)).toBe(0);
  });

  it("custear até 18 custa menos que até 24", () => {
    expect(educationFund(plan({ educationUntil: 18 }))).toBeLessThan(educationFund(example));
    expect(childrenHealthFund(plan({ educationUntil: 18 }))).toBeLessThan(
      childrenHealthFund(example),
    );
  });

  it("na idade alvo hoje, cobre todos os anos restantes", () => {
    // 1 ano de custeio: o mais novo tem 23, até os 24.
    const p = plan({ currentAge: 45, targetAge: 45, youngestAge: 23, dependents: 1 });
    expect(educationFund(p)).toBeCloseTo((13 * 2_500) / 1.095, 6);
    expect(childrenHealthFund(p)).toBeCloseTo((12 * 350) / Math.pow(1.004, 12), 6);
  });
});

describe("patrimônio e progresso", () => {
  it("soma o patrimônio externo ao do Koinos", () => {
    const summary = summaryOf(plan({ externalWealth: 500_000 }));
    expect(summary.patrimony).toBe(1_500_000);
    expect(summary.progress).toBeCloseTo(1_500_000 / 5_141_596.94, 10);
  });

  it("acima da meta: prazo 0, progresso inteiro e folga até a idade alvo", () => {
    const summary = summaryOf(example, 6_000_000);
    expect(summary.months).toBe(0);
    expect(summary.progress).toBeGreaterThan(1);
    expect(summary.slackMonths).toBe(60);
    expect(summary.requiredAporte).toBeNull();
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
  });

  it("idade alvo hoje: sem folga nem aporte necessário", () => {
    const summary = summaryOf(plan({ currentAge: 45, targetAge: 45 }));
    expect(summary.slackMonths).toBeNull();
    expect(summary.requiredAporte).toBeNull();
  });
});

describe("perpetualIncome", () => {
  it("essencial + 30% + sazonais ÷ 12 + viagens ÷ 12", () => {
    expect(perpetualIncome(defaultPlan())).toBe(0);
    expect(perpetualIncome(example)).toBe(16_000);
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
  it("com os 0,4% reais da spec v2 §2.6: R$ 57.211,73 em 60 meses", () => {
    expect(requiredAporte({ pv: 1_000_000, fv: 5_141_596.94, r: 0.004, m: 60 })).toBeCloseTo(
      57_211.73,
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
