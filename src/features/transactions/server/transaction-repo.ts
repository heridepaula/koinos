import "server-only";
import mongoose, { Types } from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import type {
  DividendEntry,
  LedgerEntry,
  PriceSource,
  TransactionKind,
  TransactionType,
} from "../domain/types";
import { hasDividendOutsideScope } from "../import/b3/changes";
import type { PlannedDividends, PlannedUpcoming } from "../import/b3/types";
import { DividendForecastModel } from "./dividend-forecast.model";
import { DividendModel } from "./dividend.model";
import { TransactionModel, type TransactionDoc, type TransactionSource } from "./transaction.model";

// Toda função recebe o portfolioId explícito e o usa em TODOS os filtros.
// Editar/excluir filtra por { _id, portfolioId } numa só operação: um id de outra carteira não encontra nada.

export type TransactionRecord = LedgerEntry & {
  source: TransactionSource;
  kind: TransactionKind;
  priceSource: PriceSource | null;
  relatedTicker: string | null;
  notes: string | null;
};

export type TransactionInput = {
  ticker: string;
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  fees: number;
  date: Date;
  kind?: TransactionKind;
  priceSource?: PriceSource | null;
  relatedTicker?: string | null;
  notes?: string | null;
};

// Lançamentos vindos do extrato da B3 só mudam por um novo upload (a B3 manda).
const NOT_FROM_B3 = { source: mongoose.trusted({ $ne: "B3" as TransactionSource }) };

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
    kind: doc.kind ?? "NEGOCIO",
    priceSource: doc.priceSource ?? null,
    relatedTicker: doc.relatedTicker ?? null,
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
    { _id: toObjectId(id), portfolioId: toObjectId(portfolioId), ...NOT_FROM_B3 },
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
    ...NOT_FROM_B3,
  });
  return result.deletedCount === 1;
}

/**
 * Troca lançamentos de uma vez, numa transação do Mongo: remove `removeIds` (só desta carteira)
 * e insere `inserts`. Com `dividends`, troca também os proventos dos FIIs do escopo dentro do
 * período do extrato; um provento novo fora desse escopo é erro. Ou entra tudo, ou nada.
 */
export async function applyTransactionChanges(
  portfolioId: string,
  changes: {
    removeIds: readonly string[];
    inserts: readonly TransactionInput[];
    source: TransactionSource;
    dividends?: PlannedDividends;
  },
): Promise<{
  removed: number;
  inserted: number;
  dividendsRemoved: number;
  dividendsInserted: number;
}> {
  await connectMongo();
  const owner = toObjectId(portfolioId);
  const session = await mongoose.startSession();
  try {
    let removed = 0;
    let inserted = 0;
    let dividendsRemoved = 0;
    let dividendsInserted = 0;
    await session.withTransaction(async () => {
      removed = 0;
      inserted = 0;
      dividendsRemoved = 0;
      dividendsInserted = 0;
      if (changes.removeIds.length > 0) {
        const result = await TransactionModel.deleteMany(
          { _id: mongoose.trusted({ $in: changes.removeIds.map(toObjectId) }), portfolioId: owner },
          { session },
        );
        removed = result.deletedCount;
        if (removed !== changes.removeIds.length) {
          throw new Error("Algum lançamento a remover não existe mais nesta carteira.");
        }
      }
      if (changes.inserts.length > 0) {
        const docs = await TransactionModel.insertMany(
          changes.inserts.map((input) => ({
            ...input,
            notes: input.notes ?? null,
            portfolioId: owner,
            source: changes.source,
          })),
          { session },
        );
        inserted = docs.length;
      }
      if (changes.dividends && hasDividendOutsideScope(changes.dividends)) {
        // Fora do escopo, o provento não seria removido num reenvio (ficaria repetido) e, com
        // `tickers` vazio, seria descartado sem aviso. O erro desfaz a transação inteira.
        throw new Error("Provento fora do escopo da troca.");
      }
      // Escopo vazio: pela trava acima também não há proventos novos, então não há o que trocar.
      if (changes.dividends && changes.dividends.tickers.length > 0) {
        // "A B3 manda": no período do extrato, os proventos de cada FII do escopo são os do extrato.
        const { period, tickers, inserts } = changes.dividends;
        const result = await DividendModel.deleteMany(
          {
            portfolioId: owner,
            ticker: mongoose.trusted({ $in: tickers }),
            paidAt: mongoose.trusted({ $gte: period.start, $lte: period.end }),
          },
          { session },
        );
        dividendsRemoved = result.deletedCount;
        if (inserts.length > 0) {
          const docs = await DividendModel.insertMany(
            inserts.map((item) => ({ ...item, portfolioId: owner, source: "B3" })),
            { session },
          );
          dividendsInserted = docs.length;
        }
      }
    });
    return { removed, inserted, dividendsRemoved, dividendsInserted };
  } finally {
    await session.endSession();
  }
}

/**
 * Atualização pela B3 (spec atualizacao-b3, §4.2), numa transação do Mongo: apaga só o que a B3
 * substitui (pelos ids, nesta carteira), insere só o que é novo e troca a foto do "a receber".
 * Um id que não existe mais desfaz tudo: a prévia ficou velha.
 */
export async function applyB3Update(
  portfolioId: string,
  changes: {
    removeIds: readonly string[];
    inserts: readonly TransactionInput[];
    dividendRemoveIds: readonly string[];
    dividendInserts: readonly DividendEntry[];
    forecast: PlannedUpcoming;
  },
): Promise<void> {
  await connectMongo();
  const owner = toObjectId(portfolioId);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (changes.removeIds.length > 0) {
        const result = await TransactionModel.deleteMany(
          { _id: mongoose.trusted({ $in: changes.removeIds.map(toObjectId) }), portfolioId: owner },
          { session },
        );
        if (result.deletedCount !== changes.removeIds.length) {
          throw new Error("Algum lançamento a remover não existe mais nesta carteira.");
        }
      }
      if (changes.inserts.length > 0) {
        await TransactionModel.insertMany(
          changes.inserts.map((input) => ({
            ...input,
            notes: input.notes ?? null,
            portfolioId: owner,
            source: "B3",
          })),
          { session },
        );
      }
      if (changes.dividendRemoveIds.length > 0) {
        const result = await DividendModel.deleteMany(
          {
            _id: mongoose.trusted({ $in: changes.dividendRemoveIds.map(toObjectId) }),
            portfolioId: owner,
          },
          { session },
        );
        if (result.deletedCount !== changes.dividendRemoveIds.length) {
          throw new Error("Algum provento a remover não existe mais nesta carteira.");
        }
      }
      if (changes.dividendInserts.length > 0) {
        await DividendModel.insertMany(
          changes.dividendInserts.map((item) => ({ ...item, portfolioId: owner, source: "B3" })),
          { session },
        );
      }
      await DividendForecastModel.updateOne(
        { portfolioId: owner },
        { $set: { asOf: changes.forecast.asOf, items: changes.forecast.items } },
        { upsert: true, runValidators: true, session },
      );
    });
  } finally {
    await session.endSession();
  }
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
