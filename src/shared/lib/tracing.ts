import { SpanStatusCode, trace, type Attributes, type Span } from "@opentelemetry/api";
import { scrubMessage, scrubStack } from "./telemetry-redaction";

// Spans manuais do app. Sem o SDK registrado (scripts, dev sem endpoint), a API do
// OpenTelemetry não faz nada e isto custa quase nada.
const tracer = trace.getTracer("koinos");

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
      recordError(span, error);
      throw error;
    } finally {
      span.end();
    }
  });
}
