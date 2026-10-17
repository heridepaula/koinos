import "server-only";
import { Types } from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import type { LedgerEntry, TransactionType } from "../domain/types";
import { TransactionModel, type TransactionDoc, type TransactionSource } from "./transaction.model";

// Toda função recebe o portfolioId explícito e o usa em TODOS os filtros.
// Editar/excluir filtra por { _id, portfolioId } numa só operação: um id de outra carteira não encontra nada.

export type TransactionRecord = LedgerEntry & { source: TransactionSource; notes: string | null };

export type TransactionInput = {
  ticker: string;
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  fees: number;
  date: Date;
  notes?: string | null;
};

const toObjectId = (id: string) => new Types.ObjectId(id);

function toRecord(doc: TransactionDoc): TransactionRecord {
  return {
    id: doc._id.toHexString(),
    ticker: doc.ticker,
    type: doc.type,
    quantity: doc.quantity,
    unitPrice: doc.unitPrice,
    fees: doc.fees ?? 0,
    date: doc.date,
    createdAt: doc.createdAt,
    source: doc.source,
    notes: doc.notes ?? null,
  };
}

export async function listTransactions(portfolioId: string): Promise<TransactionRecord[]> {
  await connectMongo();
  const docs = await TransactionModel.find({ portfolioId: toObjectId(portfolioId) })
    .sort({ date: -1, createdAt: -1 })
    .lean<TransactionDoc[]>();
  return docs.map(toRecord);
}

export async function insertTransaction(
  portfolioId: string,
  input: TransactionInput,
  source: TransactionSource = "MANUAL",
): Promise<string> {
  await connectMongo();
  const doc = await TransactionModel.create({
    ...input,
    notes: input.notes ?? null,
    portfolioId: toObjectId(portfolioId),
    source,
  });
  return doc._id.toHexString();
}

export async function insertManyTransactions(
  portfolioId: string,
  inputs: readonly TransactionInput[],
  source: TransactionSource,
): Promise<number> {
  if (inputs.length === 0) return 0;
  await connectMongo();
  const owner = toObjectId(portfolioId);
  const docs = await TransactionModel.insertMany(
    inputs.map((input) => ({ ...input, notes: input.notes ?? null, portfolioId: owner, source })),
  );
  return docs.length;
}

/** Devolve false se o lançamento não existe nesta carteira. */
export async function updateTransaction(
  portfolioId: string,
  id: string,
  input: TransactionInput,
): Promise<boolean> {
  await connectMongo();
  const result = await TransactionModel.updateOne(
    { _id: toObjectId(id), portfolioId: toObjectId(portfolioId) },
    { $set: { ...input, notes: input.notes ?? null } },
    { runValidators: true },
  );
  return result.matchedCount === 1;
}

/** Devolve false se o lançamento não existe nesta carteira. */
export async function deleteTransaction(portfolioId: string, id: string): Promise<boolean> {
  await connectMongo();
  const result = await TransactionModel.deleteOne({
    _id: toObjectId(id),
    portfolioId: toObjectId(portfolioId),
  });
  return result.deletedCount === 1;
}

export async function countTransactionsBySource(
  portfolioId: string,
  source: TransactionSource,
): Promise<number> {
  await connectMongo();
  return TransactionModel.countDocuments({ portfolioId: toObjectId(portfolioId), source });
}

export async function deleteTransactionsBySource(
  portfolioId: string,
  source: TransactionSource,
): Promise<number> {
  await connectMongo();
  const result = await TransactionModel.deleteMany({
    portfolioId: toObjectId(portfolioId),
    source,
  });
  return result.deletedCount;
}

/**
 * Tickers que aparecem em algum lançamento, com a primeira data de cada um, considerando todas as carteiras.
 * Uso interno do cron de dados de mercado: devolve só ticker e data, nada que identifique o usuário.
 */
export async function listTradedTickersWithFirstDate(): Promise<
  { ticker: string; firstDate: Date }[]
> {
  await connectMongo();
  const rows = await TransactionModel.aggregate<{ _id: string; firstDate: Date }>([
    { $group: { _id: "$ticker", firstDate: { $min: "$date" } } },
  ]);
  return rows.map((row) => ({ ticker: row._id, firstDate: row.firstDate }));
}
