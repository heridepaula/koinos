import "server-only";
import { Types } from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { draftFromV1, type PlanV1Fields } from "../domain/migrate";
import type { IndependencePlan } from "../domain/types";
import { IndependencePlanModel } from "./plan.model";

// Toda função recebe o portfolioId explícito e o usa no filtro.

const toObjectId = (id: string) => new Types.ObjectId(id);

/**
 * O plano desta carteira, sem ids. Um documento da v1 (sem `version`) não vale como plano: vira o
 * rascunho que preenche o questionário (spec v2 §4).
 */
export async function findIndependencePlan(
  portfolioId: string,
): Promise<{ plan: IndependencePlan | null; draft: IndependencePlan | null }> {
  await connectMongo();
  // lean devolve o documento como está no banco, com os campos da v1 que o schema não tem mais.
  const doc = await IndependencePlanModel.findOne({
    portfolioId: toObjectId(portfolioId),
  }).lean<Record<string, unknown> | null>();
  if (!doc) return { plan: null, draft: null };
  if (doc.version !== 2) return { plan: null, draft: draftFromV1(doc as PlanV1Fields) };
  const plan = doc as unknown as IndependencePlan;
  return {
    plan: {
      currentAge: plan.currentAge,
      targetAge: plan.targetAge,
      externalWealth: plan.externalWealth,
      essentialMonthly: plan.essentialMonthly,
      seasonalYearly: plan.seasonalYearly,
      travelYearly: plan.travelYearly,
      spouseAge: plan.spouseAge ?? null,
      dependents: plan.dependents,
      youngestAge: plan.youngestAge ?? null,
      educationMonthly: plan.educationMonthly,
      educationUntil: plan.educationUntil,
      healthLevel: plan.healthLevel,
    },
    draft: null,
  };
}

/** Substitui o documento inteiro (os campos da v1 somem), com `version: 2`. */
export async function saveIndependencePlan(
  portfolioId: string,
  plan: IndependencePlan,
): Promise<void> {
  await connectMongo();
  await IndependencePlanModel.replaceOne(
    { portfolioId: toObjectId(portfolioId) },
    { ...plan, portfolioId: toObjectId(portfolioId), version: 2 },
    { upsert: true, runValidators: true },
  );
}
