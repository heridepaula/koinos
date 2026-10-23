import "server-only";
import { Types } from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import type { DividendEntry } from "../domain/types";
import type { ExistingDividend, PlannedUpcoming } from "../import/b3/types";
import { DividendForecastModel, type DividendForecastDoc } from "./dividend-forecast.model";
import { DividendModel, type DividendDoc } from "./dividend.model";

// Mesmo padrão do transaction-repo: o portfolioId explícito vai em todos os filtros.
// A gravação dos proventos e da foto do "a receber" acontece em transaction-repo, na mesma
// transação dos lançamentos.

const toEntry = (doc: DividendDoc): DividendEntry => ({
  ticker: doc.ticker,
  paidAt: doc.paidAt,
  kind: doc.kind,
  amount: doc.amount,
  quantity: doc.quantity ?? null,
  perShare: doc.perShare ?? null,
});

async function findDividends(portfolioId: string): Promise<DividendDoc[]> {
  await connectMongo();
  return DividendModel.find({ portfolioId: new Types.ObjectId(portfolioId) })
    .sort({ paidAt: -1 })
    .lean<DividendDoc[]>();
}

/** Proventos da carteira, do mais recente para o mais antigo. Sem ids internos. */
export async function listDividends(portfolioId: string): Promise<DividendEntry[]> {
  return (await findDividends(portfolioId)).map(toEntry);
}

/** Os mesmos proventos, com o id: só para a gravação pela diferença (serviço da atualização). */
export async function listDividendRecords(portfolioId: string): Promise<ExistingDividend[]> {
  return (await findDividends(portfolioId)).map((doc) => ({
    ...toEntry(doc),
    id: doc._id.toHexString(),
  }));
}

/** A foto do "a receber" da B3 gravada na última atualização; null se nunca houve uma. */
export async function getDividendForecast(portfolioId: string): Promise<PlannedUpcoming | null> {
  await connectMongo();
  const doc = await DividendForecastModel.findOne({
    portfolioId: new Types.ObjectId(portfolioId),
  }).lean<DividendForecastDoc>();
  if (!doc) return null;
  return {
    asOf: doc.asOf,
    items: doc.items.map((item) => ({
      ticker: item.ticker,
      kind: item.kind,
      payDate: item.payDate ?? null,
      quantity: item.quantity ?? null,
      perShare: item.perShare ?? null,
      amount: item.amount,
    })),
  };
}
