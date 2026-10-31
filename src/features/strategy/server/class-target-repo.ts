import "server-only";
import { Types } from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { ClassTargetModel, type ClassTargetDoc } from "./class-target.model";

// Toda função recebe o portfolioId explícito e o usa no filtro.

const toObjectId = (id: string) => new Types.ObjectId(id);

export async function findClassTarget(portfolioId: string): Promise<{ fiiPercent: number } | null> {
  await connectMongo();
  const doc = await ClassTargetModel.findOne({
    portfolioId: toObjectId(portfolioId),
  }).lean<ClassTargetDoc>();
  return doc ? { fiiPercent: doc.fiiPercent } : null;
}

export async function saveClassTarget(portfolioId: string, fiiPercent: number): Promise<void> {
  await connectMongo();
  await ClassTargetModel.updateOne(
    { portfolioId: toObjectId(portfolioId) },
    { $set: { fiiPercent }, $setOnInsert: { portfolioId: toObjectId(portfolioId) } },
    { upsert: true, runValidators: true },
  );
}
