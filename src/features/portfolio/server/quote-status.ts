import "server-only";
import { cache } from "react";
import { latestQuoteFetchedAt } from "@/features/market-data/server";
import { getMyTargetAssets } from "@/features/strategy/server";
import { computePositions } from "@/features/transactions";
import { getMyTransactions } from "@/features/transactions/server";
import type { QuoteStatus } from "../domain/types";

/**
 * Só o horário da cotação mais nova dos ativos do usuário (em carteira + Carteira Alvo), para o
 * relógio do layout. Barato: reaproveita as leituras em `cache` do pedido e faz uma consulta
 * pequena em `assets`; não monta o snapshot.
 */
export const getQuoteStatus = cache(async (): Promise<QuoteStatus> => {
  const [transactions, targets] = await Promise.all([getMyTransactions(), getMyTargetAssets()]);
  const held = computePositions(transactions)
    .filter((position) => position.quantity > 0)
    .map((position) => position.ticker);
  return {
    lastFetchedAt: await latestQuoteFetchedAt([...held, ...targets.map((target) => target.ticker)]),
  };
});
