import "server-only";
import { cache } from "react";
import { getTenant, type Tenant } from "@/features/auth/server";
import type { DividendEntry } from "../domain/types";
import type { PlannedUpcoming } from "../import/b3/types";
import { getDividendForecast, listDividends } from "./dividend-repo";
import { listTransactions, type TransactionRecord } from "./transaction-repo";

/** Lançamentos de um tenant (que só existe se veio da sessão). */
export async function listTransactionsOf(tenant: Tenant): Promise<TransactionRecord[]> {
  return listTransactions(tenant.portfolioId);
}

/** Lançamentos do usuário logado, para renderização. React.cache evita repetir na mesma requisição. */
export const getMyTransactions = cache(async (): Promise<TransactionRecord[]> =>
  listTransactionsOf(await getTenant()),
);

/** Proventos recebidos do usuário logado (vindos dos extratos da B3), sem ids internos. */
export const getMyDividends = cache(async (): Promise<DividendEntry[]> =>
  listDividends((await getTenant()).portfolioId),
);

/** A foto do "a receber" da B3 gravada na última atualização do usuário logado; null se não há. */
export const getMyDividendForecast = cache(async (): Promise<PlannedUpcoming | null> =>
  getDividendForecast((await getTenant()).portfolioId),
);
