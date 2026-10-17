import "server-only";
import { cache } from "react";
import { getTenant, type Tenant } from "@/features/auth/server";
import { listTransactions, type TransactionRecord } from "./transaction-repo";

/** Lançamentos de um tenant (que só existe se veio da sessão). */
export async function listTransactionsOf(tenant: Tenant): Promise<TransactionRecord[]> {
  return listTransactions(tenant.portfolioId);
}

/** Lançamentos do usuário logado, para renderização. React.cache evita repetir na mesma requisição. */
export const getMyTransactions = cache(async (): Promise<TransactionRecord[]> =>
  listTransactionsOf(await getTenant()),
);
