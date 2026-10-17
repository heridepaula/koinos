import "server-only";
import { Types } from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import type { Category } from "../domain/categories";
import { TargetAssetModel, type TargetAssetDoc } from "./target-asset.model";

// Toda função recebe o portfolioId explícito e o usa em todos os filtros ({ portfolioId, ticker }).

export type TargetAssetRecord = {
  ticker: string;
  inStrategy: boolean;
  sunoRank: number | null;
  ceilingPrice: number | null;
  suggestedPercent: number | null;
  category: Category | null;
};

export type TargetAssetPatch = Partial<Omit<TargetAssetRecord, "ticker">>;

const toObjectId = (id: string) => new Types.ObjectId(id);

const DEFAULTS: Omit<TargetAssetRecord, "ticker"> = {
  inStrategy: true,
  sunoRank: null,
  ceilingPrice: null,
  suggestedPercent: null,
  category: null,
};

function toRecord(doc: TargetAssetDoc): TargetAssetRecord {
  return {
    ticker: doc.ticker,
    inStrategy: doc.inStrategy,
    sunoRank: doc.sunoRank ?? null,
    ceilingPrice: doc.ceilingPrice ?? null,
    suggestedPercent: doc.suggestedPercent ?? null,
    category: doc.category ?? null,
  };
}

export async function listTargetAssets(portfolioId: string): Promise<TargetAssetRecord[]> {
  await connectMongo();
  const docs = await TargetAssetModel.find({ portfolioId: toObjectId(portfolioId) })
    .sort({ ticker: 1 })
    .lean<TargetAssetDoc[]>();
  return docs.map(toRecord);
}

/**
 * Atualiza (ou cria) a configuração de um ativo. `defaultsOnCreate` só vale na criação,
 * e nunca sobrescreve campos que vieram no patch.
 */
export async function upsertTargetAsset(
  portfolioId: string,
  ticker: string,
  patch: TargetAssetPatch,
  defaultsOnCreate: TargetAssetPatch = {},
): Promise<void> {
  await connectMongo();
  const onInsert: Record<string, unknown> = { ...DEFAULTS, ...defaultsOnCreate };
  for (const key of Object.keys(patch)) delete onInsert[key];
  await TargetAssetModel.updateOne(
    { portfolioId: toObjectId(portfolioId), ticker },
    { $set: patch, $setOnInsert: { ...onInsert, portfolioId: toObjectId(portfolioId), ticker } },
    { upsert: true, runValidators: true },
  );
}

/** Devolve false se o ativo não estava configurado nesta carteira. */
export async function deleteTargetAsset(portfolioId: string, ticker: string): Promise<boolean> {
  await connectMongo();
  const result = await TargetAssetModel.deleteOne({ portfolioId: toObjectId(portfolioId), ticker });
  return result.deletedCount === 1;
}

/** Tickers configurados em qualquer carteira. Uso interno do cron: só tickers, nada de usuário. */
export async function listAllTargetTickers(): Promise<string[]> {
  await connectMongo();
  return TargetAssetModel.distinct("ticker");
}
