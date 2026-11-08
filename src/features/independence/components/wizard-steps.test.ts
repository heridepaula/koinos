import { describe, expect, it } from "vitest";
import { formatBRL } from "@/shared/lib/format";
import { defaultPlan } from "../domain/catalog";
import type { IndependencePlan } from "../domain/types";
import {
  answerText,
  nextStep,
  planAnswers,
  previousStep,
  STEP_TEXT,
  stepImpact,
  wizardSteps,
} from "./wizard-steps";

/** O exemplo da spec v2 §2.6, com patrimônio fora do Koinos. */
const family: IndependencePlan = {
  currentAge: 40,
  targetAge: 45,
  externalWealth: 150_000,
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

const solo: IndependencePlan = { ...family, spouseAge: null, dependents: 0, youngestAge: null };

describe("wizardSteps", () => {
  it("sem dependentes, pula a educação; a revisão é sempre o último", () => {
    expect(wizardSteps(defaultPlan())).toEqual([
      "perfil",
      "essencial",
      "sazonal",
      "familia",
      "saude",
      "viagens",
      "revisao",
    ]);
    expect(wizardSteps(family)).toContain("educacao");
    expect(wizardSteps(family).at(-1)).toBe("revisao");
  });

  it("todo passo tem título e pergunta", () => {
    for (const step of wizardSteps(family)) {
      expect(STEP_TEXT[step].title).not.toBe("");
      expect(STEP_TEXT[step].question).not.toBe("");
    }
  });
});

describe("nextStep e previousStep", () => {
  it("na ordem, pulando a educação sem dependentes nos dois sentidos", () => {
    expect(nextStep(family, "familia", null)).toBe("educacao");
    expect(nextStep(solo, "familia", null)).toBe("saude");
    expect(previousStep(family, "saude")).toBe("educacao");
    expect(previousStep(solo, "saude")).toBe("familia");
    expect(nextStep(family, "viagens", null)).toBe("revisao");
    expect(nextStep(family, "revisao", null)).toBe("revisao");
    expect(previousStep(family, "perfil")).toBe("perfil");
  });

  it("vindo da revisão, volta direto para ela", () => {
    expect(nextStep(family, "essencial", { dependents: 2 })).toBe("revisao");
    expect(nextStep(family, "familia", { dependents: 2 })).toBe("revisao");
    // Tirou os dependentes: a educação some, e a revisão vem logo.
    expect(nextStep(solo, "familia", { dependents: 2 })).toBe("revisao");
  });

  it("a família que ganhou dependentes passa pela educação antes da revisão", () => {
    expect(nextStep(family, "familia", { dependents: 0 })).toBe("educacao");
    expect(nextStep(family, "educacao", { dependents: 0 })).toBe("revisao");
  });

  it("um passo que não vale mais cai na revisão", () => {
    expect(nextStep(solo, "educacao", null)).toBe("revisao");
  });
});

describe("stepImpact", () => {
  // DY de 12% a.a. (1% ao mês): cada custo do primeiro dia pede custo ÷ 76% ÷ 1% de meta.
  const DY = 0.12;

  it("o essencial, os gastos do ano e as viagens: o custo do primeiro dia ÷ 76% ÷ o DY do mês", () => {
    expect(stepImpact("essencial", family, DY)).toBe(2_119_228); // 16.106,13 (13.000 com inflação)
    expect(stepImpact("sazonal", family, DY)).toBe(163_017); // 1.238,93
    expect(stepImpact("viagens", family, DY)).toBe(326_036); // 2.477,87
  });

  it("a escola pela inflação da educação; a saúde soma titular, cônjuge e filhos", () => {
    expect(stepImpact("educacao", family, DY)).toBe(483_332); // 3.673,32
    expect(stepImpact("saude", family, DY)).toBe(304_028); // 1.592,03 + 718,58
    expect(stepImpact("saude", { ...family, healthLevel: "nenhum" }, DY)).toBe(0);
  });

  it("DY maior, impacto menor", () => {
    expect(stepImpact("essencial", family, 0.14)!).toBeLessThan(
      stepImpact("essencial", family, DY)!,
    );
  });

  it("sem um valor só, não tem impacto", () => {
    expect(stepImpact("perfil", family, DY)).toBeNull();
    expect(stepImpact("familia", family, DY)).toBeNull();
    expect(stepImpact("revisao", family, DY)).toBeNull();
  });
});

describe("planAnswers", () => {
  it("cobre os passos do questionário, menos a revisão, com chaves únicas", () => {
    const answers = planAnswers(family);
    expect([...new Set(answers.map((answer) => answer.step))]).toEqual(
      wizardSteps(family).slice(0, -1),
    );
    const keys = answers.map((answer) => answer.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("o valor em R$ separado do texto, e o texto corrido", () => {
    const answers = planAnswers(family);
    const byKey = (key: string) => answers.find((answer) => answer.key === key)!;
    expect(byKey("idades").text).toBe("40 anos, parar aos 45");
    expect(byKey("externo").amount).toBe(150_000);
    expect(answerText(byKey("externo"))).toBe(formatBRL(150_000));
    expect(answerText(byKey("essencial"))).toBe(`${formatBRL(10_000)} por mês`);
    expect(byKey("familia").text).toBe("Cônjuge de 38 e 2 dependentes, o mais novo com 6");
    expect(answerText(byKey("educacao"))).toBe(`${formatBRL(2_500)} por mês, até os 24`);
    expect(answerText(byKey("saude"))).toBe("Conforto");
  });

  it("sozinho e sem patrimônio de fora", () => {
    const answers = planAnswers(defaultPlan());
    expect(answers[0]!.text).toBe("35 anos, parar aos 50");
    expect(answerText(answers.find((answer) => answer.key === "externo")!)).toBe("Nenhum");
    expect(answers.find((answer) => answer.key === "familia")!.text).toBe("Só você");
    expect(answers.some((answer) => answer.step === "educacao")).toBe(false);
  });

  it("um dependente, sem cônjuge", () => {
    const familyOf = (youngestAge: number) =>
      planAnswers({ ...defaultPlan(), dependents: 1, youngestAge }).find(
        (answer) => answer.key === "familia",
      )!.text;
    expect(familyOf(3)).toBe("1 dependente de 3 anos");
    expect(familyOf(1)).toBe("1 dependente de 1 ano");
  });
});
