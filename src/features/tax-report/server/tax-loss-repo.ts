import "server-only";
import { Types } from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import type { FiscalClass } from "../domain/types";
import { TaxLossBalanceModel } from "./tax-loss.model";

// Toda função recebe o portfolioId explícito e o usa no filtro.

const toObjectId = (id: string) => new Types.ObjectId(id);

/**
 * O saldo de prejuízo anterior ao livro-razão (antes de nov/2019) desta carteira, por classe;
 * null enquanto o dono não informou (o relatório avisa).
 */
export async function findOpeningLoss(
  portfolioId: string,
): Promise<Record<FiscalClass, number> | null> {
  await connectMongo();
  const doc = await TaxLossBalanceModel.findOne({
    portfolioId: toObjectId(portfolioId),
  }).lean();
  return doc ? { FII: doc.fii, ACAO: doc.acao } : null;
}

export async function saveOpeningLoss(
  portfolioId: string,
  loss: Record<FiscalClass, number>,
): Promise<void> {
  await connectMongo();
  await TaxLossBalanceModel.findOneAndUpdate(
    { portfolioId: toObjectId(portfolioId) },
    { $set: { fii: loss.FII, acao: loss.ACAO } },
    { upsert: true, runValidators: true },
  );
}
