"use server";

import { refresh } from "next/cache";
import { authActionClient } from "@/features/auth/server";
import { independencePlanSchema } from "./schemas";
import { saveIndependencePlan } from "./server/plan-repo";

/** Salva o plano do questionário (as respostas e os R$ finais de cada item). */
export const saveIndependencePlanAction = authActionClient
  .metadata({ actionName: "saveIndependencePlan" })
  .inputSchema(independencePlanSchema)
  .action(async ({ parsedInput, ctx }) => {
    await saveIndependencePlan(ctx.tenant.portfolioId, parsedInput);
    refresh();
    return { ok: true as const };
  });
