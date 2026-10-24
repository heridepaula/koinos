"use server";

import { refresh } from "next/cache";
import { ActionError, authActionClient } from "@/features/auth/server";
import { getCatalogSubType } from "@/features/market-data/server";
import { suggestCategory } from "./domain/categories";
import { targetPatchSchema, targetTickerSchema } from "./schemas";
import { deleteTargetAsset, upsertTargetAsset } from "./server/target-asset-repo";

/** Adiciona um ativo à Carteira Alvo, já na estratégia, com categoria sugerida pelo subtipo. */
export const addTargetAssetAction = authActionClient
  .metadata({ actionName: "addTargetAsset", traceInput: ["ticker"] })
  .inputSchema(targetTickerSchema)
  .action(async ({ parsedInput, ctx }) => {
    const category = suggestCategory(await getCatalogSubType(parsedInput.ticker));
    await upsertTargetAsset(
      ctx.tenant.portfolioId,
      parsedInput.ticker,
      {},
      {
        inStrategy: true,
        category,
      },
    );
    refresh();
    return { ok: true as const };
  });

/** Edita campos da configuração. Um ativo em carteira ainda sem configuração nasce fora da estratégia. */
export const updateTargetAssetAction = authActionClient
  .metadata({ actionName: "updateTargetAsset", traceInput: ["ticker"] })
  .inputSchema(targetPatchSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { ticker, ...patch } = parsedInput;
    await upsertTargetAsset(ctx.tenant.portfolioId, ticker, patch, { inStrategy: false });
    refresh();
    return { ok: true as const };
  });

export const removeTargetAssetAction = authActionClient
  .metadata({ actionName: "removeTargetAsset", traceInput: ["ticker"] })
  .inputSchema(targetTickerSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await deleteTargetAsset(ctx.tenant.portfolioId, parsedInput.ticker))) {
      throw new ActionError("Ativo não encontrado na Carteira Alvo.");
    }
    refresh();
    return { ok: true as const };
  });
