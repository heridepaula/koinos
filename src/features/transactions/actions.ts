"use server";

import { refresh } from "next/cache";
import { ActionError, authActionClient } from "@/features/auth/server";
import { formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { parseTradeDate, todayTradeDate } from "@/shared/lib/time";
import { findOversells } from "./domain/positions";
import type { LedgerEntry } from "./domain/types";
import {
  b3ImportFormSchema,
  deleteTransactionSchema,
  transactionFormSchema,
  updateTransactionSchema,
  type TransactionFormInput,
} from "./schemas";
import { confirmB3Import, previewB3Import } from "./server/b3-import";
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

const B3_LOCKED =
  "Este lançamento veio do extrato da B3. Para corrigir, envie os extratos de novo em Atualização B3.";

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
  .metadata({ actionName: "createTransaction", traceInput: ["ticker", "type"] })
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
  .metadata({ actionName: "updateTransaction", traceInput: ["ticker", "type"] })
  .inputSchema(updateTransactionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { portfolioId } = ctx.tenant;
    const input = toInput(parsedInput);
    const current = await listTransactions(portfolioId);
    const existing = current.find((entry) => entry.id === parsedInput.id);
    if (!existing) throw new ActionError("Lançamento não encontrado.");
    if (existing.source === "B3") throw new ActionError(B3_LOCKED);
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
  .metadata({ actionName: "deleteTransaction" })
  .inputSchema(deleteTransactionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { portfolioId } = ctx.tenant;
    const current = await listTransactions(portfolioId);
    const existing = current.find((entry) => entry.id === parsedInput.id);
    if (!existing) throw new ActionError("Lançamento não encontrado.");
    if (existing.source === "B3") throw new ActionError(B3_LOCKED);
    // Excluir uma compra pode deixar uma venda posterior sem cobertura.
    assertConsistentHistory(current.filter((entry) => entry.id !== parsedInput.id));
    if (!(await deleteTransaction(portfolioId, parsedInput.id))) {
      throw new ActionError("Lançamento não encontrado.");
    }
    refresh();
    return { ok: true as const };
  });

/** Prévia da atualização pela B3 (os três extratos): nada é gravado. */
export const previewB3ImportAction = authActionClient
  .metadata({ actionName: "previewB3Import" })
  .inputSchema(b3ImportFormSchema)
  .action(async ({ parsedInput, ctx }) => previewB3Import(ctx.tenant, parsedInput));

/** Atualiza pela B3: recalcula a prévia com as respostas e grava só a diferença. */
export const confirmB3ImportAction = authActionClient
  .metadata({ actionName: "confirmB3Import" })
  .inputSchema(b3ImportFormSchema)
  .action(async ({ parsedInput, ctx }) => {
    const result = await confirmB3Import(ctx.tenant, parsedInput);
    refresh();
    return result;
  });
