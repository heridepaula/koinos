import { SpanStatusCode, trace, type Attributes, type Span } from "@opentelemetry/api";
import { scrubMessage, scrubStack } from "./telemetry-redaction";

// Spans manuais do app. Sem o SDK registrado (scripts, dev sem endpoint), a API do
// OpenTelemetry não faz nada e isto custa quase nada.
const tracer = trace.getTracer("koinos");

/**
 * Erros que o Next usa como fluxo de controle: redirect, notFound, render dinâmico e o fim de um
 * prerender (no prefetch, o `connection()` rejeita de propósito quando o prerender termina). Não
 * são falhas: o span leva `koinos.control_flow` com o motivo, sem status de erro.
 */
const CONTROL_FLOW_DIGEST =
  /^(NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|NEXT_PRERENDER_INTERRUPTED|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING|HANGING_PROMISE_REJECTION)/;

const digestOf = (error: unknown) => {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" ? digest : null;
};

/** O motivo, quando o erro é fluxo de controle do Next (ex.: "NEXT_REDIRECT"); senão, null. */
function controlFlowOf(error: unknown): string | null {
  return digestOf(error)?.match(CONTROL_FLOW_DIGEST)?.[1] ?? null;
}

export function isControlFlowError(error: unknown): boolean {
  return controlFlowOf(error) !== null;
}

/** Marca o span com erro: o tipo (`error.type`) e a exceção, com a mensagem limpa. */
export function recordError(span: Span, error: unknown): void {
  const exception = error instanceof Error ? error : new Error(String(error));
  span.recordException({
    name: exception.name,
    message: scrubMessage(exception.message),
    stack: exception.stack ? scrubStack(exception.stack) : undefined,
  });
  span.setAttribute("error.type", exception.name);
  span.setStatus({ code: SpanStatusCode.ERROR });
}

/** Roda `fn` num span filho do span ativo. O span termina mesmo com erro, e o erro segue. */
export function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn(span);
    } catch (error) {
      const controlFlow = controlFlowOf(error);
      if (controlFlow) span.setAttribute("koinos.control_flow", controlFlow);
      else recordError(span, error);
      throw error;
    } finally {
      span.end();
    }
  });
}

/** Span instantâneo, só com atributos: uma medida que chegou pronta (ex.: do navegador). */
export function recordSpan(name: string, attributes: Attributes): void {
  tracer.startSpan(name, { attributes }).end();
}

/**
 * `fn` com um span `name` em volta. `describe` tira do resultado (e dos argumentos) os atributos
 * do span: só contagens e escolhas da tela, nunca valores da carteira.
 */
export function traced<A extends unknown[], R>(
  name: string,
  fn: (...args: A) => Promise<R>,
  describe: (result: R, ...args: A) => Attributes,
): (...args: A) => Promise<R> {
  return (...args) =>
    withSpan(name, {}, async (span) => {
      const result = await fn(...args);
      span.setAttributes(describe(result, ...args));
      return result;
    });
}

/**
 * Erro que o Next capturou (`onRequestError`): render, rota, action ou proxy. Vira um span
 * `request.error` com o tipo de rota e o arquivo da rota; o caminho pedido (com a query) fica fora.
 */
export function recordRequestError(
  error: unknown,
  context: { routeType: string; routePath: string; renderSource?: string },
): void {
  if (isControlFlowError(error)) return;
  const digest = digestOf(error);
  const span = tracer.startSpan("request.error", {
    attributes: {
      "next.error.route_type": context.routeType,
      "next.error.route_path": context.routePath,
      ...(context.renderSource ? { "next.error.render_source": context.renderSource } : {}),
      ...(digest ? { "next.error.digest": digest } : {}),
    },
  });
  recordError(span, error);
  span.end();
}
