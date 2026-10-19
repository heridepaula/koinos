import "server-only";
import { Types } from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import type { DividendEntry } from "../domain/types";
import { DividendModel, type DividendDoc } from "./dividend.model";

// Mesmo padrão do transaction-repo: o portfolioId explícito vai em todos os filtros.
// A troca dos proventos (remover + inserir) acontece em applyTransactionChanges, na mesma
// transação dos lançamentos.

/** Proventos da carteira, do mais recente para o mais antigo. Sem ids internos. */
export async function listDividends(portfolioId: string): Promise<DividendEntry[]> {
  await connectMongo();
  const docs = await DividendModel.find({ portfolioId: new Types.ObjectId(portfolioId) })
    .sort({ paidAt: -1 })
    .lean<DividendDoc[]>();
  return docs.map((doc) => ({
    ticker: doc.ticker,
    paidAt: doc.paidAt,
    kind: doc.kind,
    amount: doc.amount,
    quantity: doc.quantity ?? null,
    perShare: doc.perShare ?? null,
  }));
}
