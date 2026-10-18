import { formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { replayLedger } from "../domain/positions";
import type { LedgerEntry } from "../domain/types";
import type { ParsedPlanilha, ParsedTransaction } from "./parse-planilha";

export type AcceptedTicker = {
  ticker: string;
  transactions: ParsedTransaction[];
  finalQuantity: number;
};

export type RejectedTicker = { ticker: string; reasons: string[] };

const EPSILON = 1e-6;

/**
 * "Importar só as posições corretas": um ativo entra só se
 * - nenhuma linha dele tiver erro;
 * - o histórico for consistente (nenhuma venda maior que a posição na data);
 * - a quantidade final bater com a coluna QTD. da aba "Gráficos" (quando o ativo aparece lá).
 */
export function selectValidTickers(parsed: ParsedPlanilha): {
  accepted: AcceptedTicker[];
  rejected: RejectedTicker[];
} {
  const byTicker = new Map<string, ParsedTransaction[]>();
  for (const transaction of parsed.transactions) {
    byTicker.set(transaction.ticker, [...(byTicker.get(transaction.ticker) ?? []), transaction]);
  }
  const reasons = new Map<string, string[]>();
  const addReason = (ticker: string, reason: string) =>
    reasons.set(ticker, [...(reasons.get(ticker) ?? []), reason]);

  for (const error of parsed.rowErrors) {
    if (error.ticker)
      addReason(error.ticker, `${error.sheet}, linha ${error.row}: ${error.message}`);
  }

  const sheetQuantity = new Map(
    parsed.targets.map((target) => [target.ticker, target.sheetQuantity]),
  );
  const accepted: AcceptedTicker[] = [];

  for (const [ticker, transactions] of byTicker) {
    const entries: LedgerEntry[] = transactions.map((transaction, index) => ({
      id: `${transaction.sheet}:${transaction.row}`,
      ticker,
      type: transaction.type,
      quantity: transaction.quantity,
      unitPrice: transaction.unitPrice,
      fees: 0,
      date: transaction.date,
      createdAt: new Date(index),
    }));
    const { positions, oversells } = replayLedger(entries);
    const byId = new Map(transactions.map((t) => [`${t.sheet}:${t.row}`, t]));
    for (const oversell of oversells) {
      const source = byId.get(oversell.entryId);
      addReason(
        ticker,
        `${source?.sheet ?? "?"}, linha ${source?.row ?? "?"} (${formatTradeDate(oversell.date)}): venda de ${formatQuantity(oversell.sellQuantity)} com posição de ${formatQuantity(oversell.heldQuantity)}`,
      );
    }
    const finalQuantity = positions[0]?.quantity ?? 0;
    const expected = sheetQuantity.get(ticker);
    if (
      expected !== undefined &&
      expected !== null &&
      Math.abs(expected - finalQuantity) > EPSILON
    ) {
      addReason(
        ticker,
        `quantidade final ${formatQuantity(finalQuantity)} diferente da planilha (${formatQuantity(expected)})`,
      );
    }
    if (!reasons.has(ticker)) accepted.push({ ticker, transactions, finalQuantity });
  }

  const rejected = [...reasons].map(([ticker, list]) => ({ ticker, reasons: list }));
  return {
    accepted: accepted.sort((a, b) => a.ticker.localeCompare(b.ticker)),
    rejected: rejected.sort((a, b) => a.ticker.localeCompare(b.ticker)),
  };
}
