import "server-only";
import { Types } from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import type { IndependencePlan } from "../domain/types";
import { IndependencePlanModel, type IndependencePlanDoc } from "./plan.model";

// Toda função recebe o portfolioId explícito e o usa no filtro.

const toObjectId = (id: string) => new Types.ObjectId(id);

/** O plano desta carteira, sem ids, ou null antes do questionário. */
export async function findIndependencePlan(portfolioId: string): Promise<IndependencePlan | null> {
  await connectMongo();
  const doc = await IndependencePlanModel.findOne({
    portfolioId: toObjectId(portfolioId),
  }).lean<IndependencePlanDoc | null>();
  if (!doc) return null;
  return {
    answers: {
      living: doc.answers.living,
      people: doc.answers.people,
      health: doc.answers.health,
      travel: doc.answers.travel,
    },
    livingCost: doc.livingCost,
    people: doc.people,
    healthPerPerson: doc.healthPerPerson,
    travelPerYear: doc.travelPerYear,
    retention: doc.retention,
  };
}

export async function saveIndependencePlan(
  portfolioId: string,
  plan: IndependencePlan,
): Promise<void> {
  await connectMongo();
  await IndependencePlanModel.updateOne(
    { portfolioId: toObjectId(portfolioId) },
    { $set: plan, $setOnInsert: { portfolioId: toObjectId(portfolioId) } },
    { upsert: true, runValidators: true },
  );
}
