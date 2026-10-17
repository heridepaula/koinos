import "server-only";
import { getTenant } from "@/features/auth/server";
import { listTransactions, type TransactionRecord } from "./transaction-repo";

/** Lançamentos do usuário logado. O dono vem da sessão. */
export async function getMyTransactions(): Promise<TransactionRecord[]> {
  const { portfolioId } = await getTenant();
  return listTransactions(portfolioId);
}
