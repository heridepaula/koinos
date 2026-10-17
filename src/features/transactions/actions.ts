"use server";

import { refresh } from "next/cache";
import { ActionError, authActionClient } from "@/features/auth/server";
import { formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { parseTradeDate, todayTradeDate } from "@/shared/lib/time";
import { findOversells } from "./domain/positions";
import type { LedgerEntry } from "./domain/types";
import {
  deleteTransactionSchema,
  transactionFormSchema,
  updateTransactionSchema,
  type TransactionFormInput,
} from "./schemas";
import {
  deleteTransaction,
  insertTransaction,
  listTransactions,
  updateTransaction,
  type TransactionInput,
} from "./server/transaction-repo";

function toInput(form: TransactionFormInput): TransactionInput {
  const date = parseTradeDate(form.date);
  if (date.getTime() > todayTradeDate(new Date()).getTime()) {
    throw new ActionError("A data do negócio não pode ser no futuro.");
  }
  return {
    ticker: form.ticker,
    type: form.type,
    quantity: form.quantity,
    unitPrice: form.unitPrice,
    fees: form.fees,
    date,
    notes: form.notes || null,
  };
}

/** Rejeita qualquer gravação que deixe uma venda maior que a posição na data. */
function assertConsistentHistory(entries: readonly LedgerEntry[]) {
  const [first] = findOversells(entries);
  if (first) {
    throw new ActionError(
      `Venda de ${formatQuantity(first.sellQuantity)} cotas de ${first.ticker} em ${formatTradeDate(first.date)}, mas a posição nessa data é ${formatQuantity(first.heldQuantity)}.`,
    );
  }
}

export const createTransactionAction = authActionClient
  .inputSchema(transactionFormSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { portfolioId } = ctx.tenant;
    const input = toInput(parsedInput);
    const current = await listTransactions(portfolioId);
    assertConsistentHistory([...current, { ...input, id: "novo", createdAt: new Date() }]);
    await insertTransaction(portfolioId, input);
    refresh();
    return { ok: true as const };
  });

export const updateTransactionAction = authActionClient
  .inputSchema(updateTransactionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { portfolioId } = ctx.tenant;
    const input = toInput(parsedInput);
    const current = await listTransactions(portfolioId);
    const existing = current.find((entry) => entry.id === parsedInput.id);
    if (!existing) throw new ActionError("Lançamento não encontrado.");
    assertConsistentHistory(
      current.map((entry) => (entry.id === existing.id ? { ...entry, ...input } : entry)),
    );
    if (!(await updateTransaction(portfolioId, existing.id, input))) {
      throw new ActionError("Lançamento não encontrado.");
    }
    refresh();
    return { ok: true as const };
  });

export const deleteTransactionAction = authActionClient
  .inputSchema(deleteTransactionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { portfolioId } = ctx.tenant;
    const current = await listTransactions(portfolioId);
    if (!current.some((entry) => entry.id === parsedInput.id)) {
      throw new ActionError("Lançamento não encontrado.");
    }
    // Excluir uma compra pode deixar uma venda posterior sem cobertura.
    assertConsistentHistory(current.filter((entry) => entry.id !== parsedInput.id));
    if (!(await deleteTransaction(portfolioId, parsedInput.id))) {
      throw new ActionError("Lançamento não encontrado.");
    }
    refresh();
    return { ok: true as const };
  });
