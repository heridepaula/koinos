import { describe, expect, it } from "vitest";
import { defaultPlan } from "./catalog";
import { IMPLIED_MONTHLY_INFLATION, NOMINAL_ANNUAL_RETURN, REAL_MONTHLY_RATE } from "./constants";
import {
  childrenHealthFund,
  durationLabel,
  educationFund,
  independenceSummary,
  monthsToTarget,
  perpetualIncome,
  planTarget,
  requiredAporte,
  targetMonthKey,
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

const summaryOf = (p: IndependencePlan, koinosWealth = 1_000_000, monthlyAporte = 8_000) =>
  independenceSummary({ plan: p, koinosWealth, monthlyAporte, currentMonth: "2026-11" });

describe("o exemplo da spec v2", () => {
  const summary = summaryOf(example);

  it("meta perpétua: renda ÷ r, titular e cônjuge em degraus", () => {
    expect(summary.perpetualIncome).toBe(13_000);
    expect(summary.incomeCapital).toBe(3_250_000);
    expect(summary.titularHealthNow).toBe(735);
    expect(summary.healthStepAges).toEqual([49, 54, 59]);
    expect(summary.titularHealth).toBe(332_777.82);
    expect(summary.spouseAgeAtTarget).toBe(43);
    expect(summary.spouseHealth).toBe(316_999);
    expect(summary.perpetual).toBe(3_899_776.83);
  });

  it("fundo temporário: escola e saúde dos filhos depois da idade alvo", () => {
    expect(summary.educationFund).toBe(421_812.65);
    expect(summary.childrenHealthFund).toBe(70_007.47);
    expect(summary.temporary).toBe(491_820.11);
  });

  it("meta total, prazo, idade prevista e aporte necessário", () => {
    expect(summary.target).toBe(4_391_596.94);
    expect(summary.months).toBe(190);
    expect(durationLabel(summary.months!)).toBe("15 anos e 10 meses");
    expect(summary.targetMonth).toBe("2042-09");
    expect(summary.predictedAge).toBe(55);
    expect(summary.slackMonths).toBeNull();
    expect(summary.requiredAporte).toBe(46_126.93);
  });

  it("planTarget é a meta do resumo, sem patrimônio nem prazo", () => {
    expect(planTarget(example)).toBe(summary.target);
    expect(planTarget(plan({ dependents: 0, youngestAge: null }))).toBe(
      summaryOf(plan({ dependents: 0, youngestAge: null }), 0, 0).target,
    );
  });

  it("rentabilidade mensal: renda real + reinvestimento da inflação (§2.7)", () => {
    expect(summary.realIncome).toBe(17_566.39);
    expect(summary.inflationReinvestment).toBe(15_709.73);
    expect(summary.monthlyYield).toBe(33_276.12);
    expect(summary.monthlyYield).toBe(
      Math.round((summary.realIncome + summary.inflationReinvestment) * 100) / 100,
    );
  });
});

describe("inflação implícita", () => {
  it("9,5% a.a. nominal sobre 0,4% a.m. real: ≈ 0,358% a.m. e ≈ 4,38% a.a.", () => {
    expect(IMPLIED_MONTHLY_INFLATION).toBeCloseTo(0.003577, 6);
    expect((1 + IMPLIED_MONTHLY_INFLATION) ** 12 - 1).toBeCloseTo(0.0438, 4);
    // Real e inflação juntos dão o rendimento nominal da carteira.
    expect(((1 + REAL_MONTHLY_RATE) * (1 + IMPLIED_MONTHLY_INFLATION)) ** 12 - 1).toBeCloseTo(
      NOMINAL_ANNUAL_RETURN,
      10,
    );
  });

  it("meta zero não rende nada", () => {
    const summary = summaryOf(defaultPlan(), 0, 0);
    expect(summary.target).toBeGreaterThan(0); // a saúde Conforto do padrão já pede patrimônio
    const empty = summaryOf({ ...defaultPlan(), healthLevel: "nenhum" }, 0, 0);
    expect(empty.target).toBe(0);
    expect(empty.monthlyYield).toBe(0);
    expect(empty.inflationReinvestment).toBe(0);
    expect(empty.realIncome).toBe(0);
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
    expect(summary.progress).toBeCloseTo(1_500_000 / 4_391_596.94, 10);
  });

  it("acima da meta: prazo 0, progresso inteiro e folga até a idade alvo", () => {
    const summary = summaryOf(example, 5_000_000);
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
  it("essencial + sazonais ÷ 12 + viagens ÷ 12", () => {
    expect(perpetualIncome(defaultPlan())).toBe(0);
    expect(perpetualIncome(example)).toBe(13_000);
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
  it("o exemplo da spec: R$ 46.126,93 em 60 meses", () => {
    expect(requiredAporte({ pv: 1_000_000, fv: 4_391_596.94, r: 0.004, m: 60 })).toBeCloseTo(
      46_126.93,
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
