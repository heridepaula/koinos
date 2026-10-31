import "server-only";
import { getAssetClasses, getAssetSnapshots } from "@/features/market-data/server";
import { getMyTransactions } from "@/features/transactions/server";
import { byClass, type ClassFilter } from "@/shared/lib/class-filter";
import { traced } from "@/shared/lib/tracing";
import { closedPositions, summarizeClosedPositions } from "../domain/closed-positions";
import type { ClosedPositionsView } from "../domain/types";

/**
 * Tela de posições encerradas do usuário logado: o custo pelo preço médio, o vendido, o resultado
 * e o IR estimado de cada ativo zerado. Os lançamentos vêm da DAL, que lê só a carteira da sessão
 * (`getTenant`, que também chama `connection()`). O resultado é um DTO sem ids internos.
 */
export const getClosedPositionsView = traced(
  "view.closed-positions",
  async (filter: ClassFilter = "TODOS"): Promise<ClosedPositionsView> => {
    const transactions = await getMyTransactions();
    const classes = await getAssetClasses(transactions.map((entry) => entry.ticker));
    // Na visão Ações, o razão ainda tem todas as vendas de ações: a isenção do mês não muda.
    const scoped = byClass(transactions, (ticker) => classes.get(ticker) ?? null, filter);
    const rows = closedPositions(scoped, classes);
    const assets = await getAssetSnapshots(rows.map((row) => row.ticker));
    return {
      rows: rows.map((row) => ({
        ...row,
        name: assets.get(row.ticker)?.name ?? null,
        logoUrl: assets.get(row.ticker)?.logoUrl ?? null,
      })),
      totals: summarizeClosedPositions(rows),
    };
  },
  (view, filter = "TODOS") => ({
    "koinos.view.closed": view.rows.length,
    "koinos.view.class_filter": filter,
  }),
);
