"use server";

import { refresh } from "next/cache";
import { ActionError, authActionClient } from "@/features/auth/server";
import { getAssetClasses, getCatalogSubType } from "@/features/market-data/server";
import { suggestCategory } from "./domain/categories";
import { suggestedPercentProblem } from "./domain/quarantine";
import {
  addTargetSchema,
  classTargetSchema,
  suggestedPercentsSchema,
  targetPatchSchema,
  targetTickerSchema,
} from "./schemas";
import { saveClassTarget } from "./server/class-target-repo";
import { deleteTargetAsset, findTargetAsset, upsertTargetAsset } from "./server/target-asset-repo";

/** A classe pelo catálogo: ACAO, ou FII para todo o resto (como o snapshot). */
async function classOf(ticker: string): Promise<"FII" | "ACAO"> {
  return (await getAssetClasses([ticker])).get(ticker) === "ACAO" ? "ACAO" : "FII";
}

/** Adiciona um ativo à Carteira Alvo da aba, já na estratégia. A ação nasce com a categoria Ação. */
export const addTargetAssetAction = authActionClient
  .metadata({ actionName: "addTargetAsset", traceInput: ["ticker"] })
  .inputSchema(addTargetSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { ticker, assetClass } = parsedInput;
    const actual = await classOf(ticker);
    if (actual !== assetClass) {
      throw new ActionError(
        actual === "ACAO"
          ? `${ticker} é ação: adicione na aba Ações.`
          : `${ticker} não é ação: adicione na aba FIIs.`,
      );
    }
    const category = actual === "ACAO" ? "ACAO" : suggestCategory(await getCatalogSubType(ticker));
    await upsertTargetAsset(ctx.tenant.portfolioId, ticker, {}, { inStrategy: true, category });
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
    if (patch.category != null) {
      const isStock = (await classOf(ticker)) === "ACAO";
      if (isStock && patch.category !== "ACAO") {
        throw new ActionError("A categoria de uma ação é sempre Ação.");
      }
      if (!isStock && patch.category === "ACAO") {
        throw new ActionError("A categoria Ação é só para ações.");
      }
    }
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
    const classes = await getAssetClasses(parsedInput.items.map((item) => item.ticker));
    const kinds = new Set(
      parsedInput.items.map((item) => (classes.get(item.ticker) === "ACAO" ? "ACAO" : "FII")),
    );
    if (kinds.size > 1) {
      throw new ActionError("As % de FIIs e de ações ficam em carteiras separadas.");
    }
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

/** Grava a meta entre FIIs e ações (spec aporte por classe, §5). */
export const setClassTargetAction = authActionClient
  .metadata({ actionName: "setClassTarget" })
  .inputSchema(classTargetSchema)
  .action(async ({ parsedInput, ctx }) => {
    await saveClassTarget(ctx.tenant.portfolioId, parsedInput.fiiPercent);
    refresh();
    return { ok: true as const };
  });
