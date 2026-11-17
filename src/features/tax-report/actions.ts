"use server";

import { refresh } from "next/cache";
import { ActionError, authActionClient } from "@/features/auth/server";
import { setAssetCnpj } from "@/features/market-data/server";
import { listDividendsOf, listTransactionsOf } from "@/features/transactions/server";
import { formatCnpj } from "./domain/cnpj";
import { round2 } from "./domain/format";
import { reportTickers } from "./domain/report-view";
import { assetCnpjSchema, openingLossSchema } from "./schemas";
import { saveOpeningLoss } from "./server/tax-loss-repo";

/** Salva o saldo de prejuízo anterior ao livro-razão (antes de nov/2019), por classe, em R$. */
export const saveOpeningLossAction = authActionClient
  .metadata({ actionName: "saveOpeningLoss" })
  .inputSchema(openingLossSchema)
  .action(async ({ parsedInput, ctx }) => {
    await saveOpeningLoss(ctx.tenant.portfolioId, {
      FII: round2(parsedInput.fii),
      ACAO: round2(parsedInput.acao),
    });
    refresh();
    return { ok: true as const };
  });

/** CNPJ digitado pelo dono para um ativo que a CVM não casou: vale sobre o da CVM e nunca é sobrescrito. */
export const setAssetCnpjAction = authActionClient
  .metadata({ actionName: "setAssetCnpj" })
  .inputSchema(assetCnpjSchema)
  .action(async ({ parsedInput, ctx }) => {
    const [entries, dividends] = await Promise.all([
      listTransactionsOf(ctx.tenant),
      listDividendsOf(ctx.tenant),
    ]);
    if (!reportTickers(entries, dividends).includes(parsedInput.ticker)) {
      throw new ActionError("Ativo não encontrado na sua carteira");
    }
    const saved = await setAssetCnpj(parsedInput.ticker, formatCnpj(parsedInput.cnpj));
    if (!saved) throw new ActionError("Ativo não encontrado na sua carteira");
    refresh();
    return { ok: true as const };
  });
