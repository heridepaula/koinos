import { formatBRL } from "@/shared/lib/format";
import { HEALTH_LEVEL_LABELS } from "../domain/catalog";
import { planTarget } from "../domain/plan";
import type { IndependencePlan } from "../domain/types";

// Os passos do questionário (spec v2 §3), em código puro: a ordem, os textos, a navegação, o
// impacto de cada resposta na meta e as respostas que a revisão lista.

export type StepKey =
  "perfil" | "essencial" | "sazonal" | "familia" | "educacao" | "saude" | "viagens" | "revisao";

export const STEP_TEXT: Record<StepKey, { title: string; question: string }> = {
  perfil: { title: "Perfil", question: "De onde você parte e quando quer parar?" },
  essencial: {
    title: "Custo de vida",
    question: "Quanto você gasta por mês com moradia, contas, mercado e cartões?",
  },
  sazonal: {
    title: "Gastos do ano",
    question: "Quanto vai por ano em IPVA, IPTU, seguros e manutenção?",
  },
  familia: { title: "Família", question: "Quem mais depende do seu orçamento?" },
  educacao: {
    title: "Educação",
    question: "Quanto custam hoje a escola, os cursos e a van dos dependentes?",
  },
  saude: { title: "Saúde", question: "Que plano de saúde você quer ter na independência?" },
  viagens: {
    title: "Estilo de vida",
    question: "Quanto você quer gastar por ano com viagens e lazer extra?",
  },
  revisao: { title: "Revisão", question: "Confira a meta antes de salvar." },
};

/** Os passos, em ordem: a educação só entra com dependentes, e a revisão fecha. */
export function wizardSteps(plan: IndependencePlan): StepKey[] {
  return [
    "perfil",
    "essencial",
    "sazonal",
    "familia",
    ...(plan.dependents > 0 ? (["educacao"] as const) : []),
    "saude",
    "viagens",
    "revisao",
  ];
}

/**
 * Um passo aberto a partir da revisão: guarda quantos dependentes havia, para saber se a família
 * ganhou dependentes agora (e a educação passou a valer).
 */
export type ReturnToReview = { dependents: number };

/**
 * O passo seguinte. Vindo da revisão, volta direto para ela, menos quando a família ganhou
 * dependentes agora: a educação passa a valer e vem antes.
 */
export function nextStep(
  plan: IndependencePlan,
  step: StepKey,
  returning: ReturnToReview | null,
): StepKey {
  if (returning) {
    const gainedDependents = returning.dependents === 0 && plan.dependents > 0;
    return step === "familia" && gainedDependents ? "educacao" : "revisao";
  }
  const steps = wizardSteps(plan);
  const index = steps.indexOf(step);
  return index === -1 ? "revisao" : steps[Math.min(index + 1, steps.length - 1)]!;
}

/** O passo anterior (o primeiro fica no lugar). */
export function previousStep(plan: IndependencePlan, step: StepKey): StepKey {
  const steps = wizardSteps(plan);
  return steps[Math.max(0, steps.indexOf(step) - 1)]!;
}

/** A resposta de cada passo zerada: a meta sem ela mostra quanto ela pesa. */
const WITHOUT: Partial<Record<StepKey, Partial<IndependencePlan>>> = {
  essencial: { essentialMonthly: 0 },
  sazonal: { seasonalYearly: 0 },
  educacao: { educationMonthly: 0 },
  saude: { healthLevel: "nenhum" },
  viagens: { travelYearly: 0 },
};

/**
 * Quanto a resposta do passo soma à meta: a meta com ela menos a meta sem ela. null nos passos
 * sem um valor só (o perfil muda todas as contas; a família depende da saúde e da escola).
 */
export function stepImpact(step: StepKey, plan: IndependencePlan): number | null {
  const without = WITHOUT[step];
  if (!without) return null;
  return Math.round((planTarget(plan) - planTarget({ ...plan, ...without })) * 100) / 100;
}

/** Uma resposta da revisão: tocar nela leva ao passo dela. */
export type PlanAnswer = {
  key: string;
  step: StepKey;
  label: string;
  /** O valor em R$ (fica sob o `Sensitive` na tela); sem ele, a resposta é só o texto. */
  amount?: number;
  /** A resposta, ou o que vem depois do valor ("por mês"). */
  text: string;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "Cônjuge de 38 e 2 dependentes, o mais novo com 6", "1 dependente de 3 anos", "Só você". */
function familyText(plan: IndependencePlan): string {
  const parts: string[] = [];
  if (plan.spouseAge !== null) parts.push(`Cônjuge de ${plan.spouseAge}`);
  if (plan.dependents > 0) {
    const age = plan.youngestAge ?? 0;
    parts.push(
      plan.dependents === 1
        ? `1 dependente de ${plural(age, "ano", "anos")}`
        : `${plan.dependents} dependentes, o mais novo com ${age}`,
    );
  }
  return parts.length === 0 ? "Só você" : parts.join(" e ");
}

/** As respostas, na ordem do questionário. */
export function planAnswers(plan: IndependencePlan): PlanAnswer[] {
  return [
    {
      key: "idades",
      step: "perfil",
      label: "Idades",
      text: `${plan.currentAge} anos, parar aos ${plan.targetAge}`,
    },
    plan.externalWealth > 0
      ? {
          key: "externo",
          step: "perfil",
          label: "Fora do Koinos",
          amount: plan.externalWealth,
          text: "",
        }
      : { key: "externo", step: "perfil", label: "Fora do Koinos", text: "Nenhum" },
    {
      key: "essencial",
      step: "essencial",
      label: "Custo de vida",
      amount: plan.essentialMonthly,
      text: "por mês",
    },
    {
      key: "sazonal",
      step: "sazonal",
      label: "Gastos do ano",
      amount: plan.seasonalYearly,
      text: "por ano",
    },
    { key: "familia", step: "familia", label: "Família", text: familyText(plan) },
    ...(plan.dependents > 0
      ? [
          {
            key: "educacao",
            step: "educacao" as const,
            label: "Educação",
            amount: plan.educationMonthly,
            text: `por mês, até os ${plan.educationUntil}`,
          },
        ]
      : []),
    {
      key: "saude",
      step: "saude",
      label: "Saúde",
      text: HEALTH_LEVEL_LABELS[plan.healthLevel].label,
    },
    {
      key: "viagens",
      step: "viagens",
      label: "Viagens e lazer",
      amount: plan.travelYearly,
      text: "por ano",
    },
  ];
}

/** A resposta em texto corrido: "R$ 10.000,00 por mês". */
export function answerText(answer: PlanAnswer): string {
  if (answer.amount === undefined) return answer.text;
  const amount = formatBRL(answer.amount);
  return answer.text ? `${amount} ${answer.text}` : amount;
}
