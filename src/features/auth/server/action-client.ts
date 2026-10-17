import "server-only";
import { createSafeActionClient } from "next-safe-action";
import { requireTenant, UnauthorizedError } from "./session";

/** Erro com mensagem que pode ser mostrada ao usuário. */
export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

const baseActionClient = createSafeActionClient({
  // Só mensagens seguras chegam ao navegador; o detalhe fica no log do servidor.
  handleServerError(error) {
    if (error instanceof ActionError || error instanceof UnauthorizedError) return error.message;
    console.error("[action]", error);
    return "Não foi possível concluir a operação. Tente novamente.";
  },
});

/** Actions autenticadas: o tenant vem da sessão e chega em `ctx.tenant`. */
export const authActionClient = baseActionClient.use(async ({ next }) => {
  const tenant = await requireTenant();
  return next({ ctx: { tenant } });
});
