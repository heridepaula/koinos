"use server";

import { refresh } from "next/cache";
import { ActionError, authActionClient } from "@/features/auth/server";
import { getCatalogSubType } from "@/features/market-data/server";
import { suggestCategory } from "./domain/categories";
import { suggestedPercentProblem } from "./domain/quarantine";
import { suggestedPercentsSchema, targetPatchSchema, targetTickerSchema } from "./schemas";
import { deleteTargetAsset, findTargetAsset, upsertTargetAsset } from "./server/target-asset-repo";

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

/**
 * Edita campos da configuração. Um ativo em carteira ainda sem configuração nasce fora da estratégia.
 * 0% é a quarentena, então só vale fora da estratégia: na estratégia, a % vazia divide o que falta.
 * Por isso um ativo com 0% que entra na estratégia volta a ficar sem %.
 */
export const updateTargetAssetAction = authActionClient
  .metadata({ actionName: "updateTargetAsset", traceInput: ["ticker"] })
  .inputSchema(targetPatchSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { ticker, ...patch } = parsedInput;
    const stored = await findTargetAsset(ctx.tenant.portfolioId, ticker);
    const inStrategy = patch.inStrategy ?? stored?.inStrategy ?? false;
    const problem = suggestedPercentProblem(patch.suggestedPercent ?? null, inStrategy);
    if (problem) throw new ActionError(problem);
    const enteringWithZero =
      patch.inStrategy === true &&
      patch.suggestedPercent === undefined &&
      stored?.suggestedPercent === 0;
    await upsertTargetAsset(
      ctx.tenant.portfolioId,
      ticker,
      enteringWithZero ? { ...patch, suggestedPercent: null } : patch,
      { inStrategy: false },
    );
    refresh();
    return { ok: true as const };
  });

/** Grava as % do ajuste sugerido (para a soma fechar 100%). */
export const setSuggestedPercentsAction = authActionClient
  .metadata({ actionName: "setSuggestedPercents" })
  .inputSchema(suggestedPercentsSchema)
  .action(async ({ parsedInput, ctx }) => {
    for (const item of parsedInput.items) {
      await upsertTargetAsset(
        ctx.tenant.portfolioId,
        item.ticker,
        { suggestedPercent: item.suggestedPercent },
        { inStrategy: false },
      );
    }
    refresh();
    return { ok: true as const, count: parsedInput.items.length };
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
