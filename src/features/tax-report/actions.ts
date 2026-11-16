"use server";

import { refresh } from "next/cache";
import { ActionError, authActionClient } from "@/features/auth/server";
import { setAssetCnpj } from "@/features/market-data/server";
import { listDividendsOf, listTransactionsOf } from "@/features/transactions/server";
import { formatCnpj } from "./domain/cnpj";
import { round2 } from "./domain/format";
import { reportTickers } from "./domain/report-view";
import { assetCnpjSchema, generateNarrativesSchema, openingLossSchema } from "./schemas";
import { generateTaxNarratives } from "./server/narrative-service";
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

/**
 * Gera os textos do Gemini do relatório do ano (reescrita da discriminação e uma explicação por
 * tipo de achado). Só o dono aciona, pelo botão da aba Resumo: manda dados da carteira ao Gemini
 * (exceção de privacidade da spec §6). Uma falha grava `failed` e mantém os textos de antes.
 */
export const generateTaxNarrativesAction = authActionClient
  .metadata({ actionName: "generateTaxNarratives" })
  .inputSchema(generateNarrativesSchema)
  .action(async ({ parsedInput, ctx }) => {
    const status = await generateTaxNarratives(ctx.tenant, parsedInput.year);
    refresh();
    return { status };
  });
