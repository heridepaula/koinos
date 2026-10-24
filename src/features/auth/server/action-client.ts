import "server-only";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";
import { recordError, withSpan } from "@/shared/lib/tracing";
import { requireTenant, UnauthorizedError } from "./session";

/** Erro com mensagem que pode ser mostrada ao usuário. */
export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

/**
 * Campos de entrada que podem ir para o APM: só identificadores, nunca quantidades, preços,
 * notas, ids ou arquivos. Um campo novo aqui é uma decisão de privacidade.
 */
const TRACEABLE_INPUT_FIELDS = ["ticker", "type", "month"] as const;
/** Os três são curtos; o corte só protege de uma entrada maliciosa enorme. */
const MAX_INPUT_LENGTH = 64;

const actionMetadataSchema = z.object({
  /** Nome da action no APM: o span se chama "action <nome>". */
  actionName: z.string().min(1),
  /** Campos da entrada validada que vão para o span, como `koinos.action.input.<campo>`. */
  traceInput: z.array(z.enum(TRACEABLE_INPUT_FIELDS)).optional(),
});

const isExpected = (error: unknown): error is ActionError | UnauthorizedError =>
  error instanceof ActionError || error instanceof UnauthorizedError;

const baseActionClient = createSafeActionClient({
  defineMetadataSchema: () => actionMetadataSchema,
  // Só mensagens seguras chegam ao navegador; o detalhe fica no log do servidor.
  handleServerError(error) {
    // Roda dentro do span da action (é o ativo): a exceção entra no trace.
    const span = trace.getActiveSpan();
    if (span) {
      recordError(span, error);
      span.setAttribute("koinos.action.error_kind", isExpected(error) ? "expected" : "unexpected");
    }
    if (isExpected(error)) return error.message;
    console.error("[action]", error);
    return "Não foi possível concluir a operação. Tente novamente.";
  },
}).use(async ({ next, metadata, clientInput }) =>
  // Primeiro da cadeia: o span cobre a sessão, a validação e a action.
  withSpan(
    `action ${metadata.actionName}`,
    { "koinos.action.name": metadata.actionName },
    async (span) => {
      const result = await next();
      const outcome =
        result.validationErrors !== undefined
          ? "validation_error"
          : result.serverError !== undefined
            ? "server_error"
            : result.navigationKind !== undefined
              ? "navigation"
              : "success";
      span.setAttribute("koinos.action.outcome", outcome);
      // Erro de validação é do formulário, não do sistema: não conta como falha.
      if (outcome === "server_error") span.setStatus({ code: SpanStatusCode.ERROR });
      else if (outcome === "success") span.setStatus({ code: SpanStatusCode.OK });
      // A entrada validada só existe quando a action termina bem; numa falha, vale a enviada.
      const input = result.parsedInput ?? clientInput;
      if (input && typeof input === "object") {
        for (const field of metadata.traceInput ?? []) {
          const value = (input as Record<string, unknown>)[field];
          if (typeof value === "string") {
            span.setAttribute(`koinos.action.input.${field}`, value.slice(0, MAX_INPUT_LENGTH));
          }
        }
      }
      return result;
    },
  ),
);

/** Actions autenticadas: o tenant vem da sessão e chega em `ctx.tenant`. */
export const authActionClient = baseActionClient.use(async ({ next }) => {
  const tenant = await requireTenant();
  return next({ ctx: { tenant } });
});
