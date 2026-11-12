import "server-only";
import { Types } from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import type { Bias } from "../domain/bias";
import type { Category } from "../domain/categories";
import { TargetAssetModel, type TargetAssetDoc } from "./target-asset.model";

// Toda função recebe o portfolioId explícito e o usa em todos os filtros ({ portfolioId, ticker }).

export type TargetAssetRecord = {
  ticker: string;
  inStrategy: boolean;
  rank: number | null;
  ceilingPrice: number | null;
  suggestedPercent: number | null;
  category: Category | null;
  bias: Bias | null;
};

export type TargetAssetPatch = Partial<Omit<TargetAssetRecord, "ticker">>;

const toObjectId = (id: string) => new Types.ObjectId(id);

const DEFAULTS: Omit<TargetAssetRecord, "ticker"> = {
  inStrategy: true,
  rank: null,
  ceilingPrice: null,
  suggestedPercent: null,
  category: null,
  bias: null,
};

function toRecord(doc: TargetAssetDoc): TargetAssetRecord {
  return {
    ticker: doc.ticker,
    inStrategy: doc.inStrategy,
    rank: doc.rank ?? null,
    ceilingPrice: doc.ceilingPrice ?? null,
    suggestedPercent: doc.suggestedPercent ?? null,
    category: doc.category ?? null,
    bias: doc.bias ?? null,
  };
}

export async function listTargetAssets(portfolioId: string): Promise<TargetAssetRecord[]> {
  await connectMongo();
  const docs = await TargetAssetModel.find({ portfolioId: toObjectId(portfolioId) })
    .sort({ ticker: 1 })
    .lean<TargetAssetDoc[]>();
  return docs.map(toRecord);
}

/** A configuração de um ativo, ou null se ele ainda não foi configurado nesta carteira. */
export async function findTargetAsset(
  portfolioId: string,
  ticker: string,
): Promise<TargetAssetRecord | null> {
  await connectMongo();
  const doc = await TargetAssetModel.findOne({
    portfolioId: toObjectId(portfolioId),
    ticker,
  }).lean<TargetAssetDoc>();
  return doc ? toRecord(doc) : null;
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

/**
 * Ticker e melhor rank de cada ativo configurado em qualquer carteira. Uso interno do cron do
 * resumo da IA: nada de usuário além do rank, que nunca sai do servidor.
 */
export async function listAllTargetRanks(): Promise<{ ticker: string; rank: number | null }[]> {
  await connectMongo();
  const rows = await TargetAssetModel.aggregate<{ _id: string; rank: number | null }>([
    { $group: { _id: "$ticker", rank: { $min: "$rank" } } },
  ]);
  return rows.map((row) => ({ ticker: row._id, rank: row.rank ?? null }));
}

/** Tickers configurados em qualquer carteira. Uso interno do cron: só tickers, nada de usuário. */
export async function listAllTargetTickers(): Promise<string[]> {
  await connectMongo();
  return TargetAssetModel.distinct("ticker");
}
