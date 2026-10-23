import "server-only";
import { Types } from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { ReinvestmentModel, type ReinvestmentDoc } from "./reinvestment.model";

// Toda função recebe o portfolioId explícito e o usa em todos os filtros ({ portfolioId, month }).

const toObjectId = (id: string) => new Types.ObjectId(id);

/** % salva de cada mês desta carteira (AAAA-MM → %). */
export async function listReinvestmentPercents(portfolioId: string): Promise<Map<string, number>> {
  await connectMongo();
  const docs = await ReinvestmentModel.find(
    { portfolioId: toObjectId(portfolioId) },
    { month: 1, percent: 1 },
  ).lean<Pick<ReinvestmentDoc, "month" | "percent">[]>();
  return new Map(docs.map((doc) => [doc.month, doc.percent]));
}

export async function setReinvestmentPercent(
  portfolioId: string,
  month: string,
  percent: number,
): Promise<void> {
  await connectMongo();
  await ReinvestmentModel.updateOne(
    { portfolioId: toObjectId(portfolioId), month },
    { $set: { percent }, $setOnInsert: { portfolioId: toObjectId(portfolioId), month } },
    { upsert: true, runValidators: true },
  );
}

/** Volta o mês ao padrão (100%). */
export async function clearReinvestmentPercent(portfolioId: string, month: string): Promise<void> {
  await connectMongo();
  await ReinvestmentModel.deleteOne({ portfolioId: toObjectId(portfolioId), month });
}
