import type { ReadableSpan, Span, SpanProcessor } from "@opentelemetry/sdk-trace-base";

// O que sai do servidor para o APM. A query string fica de fora porque a volta do login do
// Google traz `?code=`, o Yahoo traz `crumb=` e as páginas guardam valores da carteira na URL
// (`?valor=`). As mensagens de erro vão sem e-mails e sem números (quantidades, preços, datas).

/** Atributos que carregam uma URL inteira: só o caminho segue. */
const URL_ATTRIBUTES = ["http.target", "http.url", "url.full"];
/** Atributos que são só a query string: saem inteiros. */
const QUERY_ATTRIBUTES = ["url.query"];

const EMAIL = /[^\s@"'<>()[\]{}]+@[^\s@"'<>()[\]{}]+\.[a-z]{2,}/gi;
const URL_WITH_QUERY = /(https?:\/\/[^\s?#"'<>]+)\?[^\s"'<>]*/gi;
const NUMBER = /\d+(?:[.,]\d+)*/g;
const STACK_FRAME = /^\s+at /;

/** URL sem a query string (e sem o fragmento). */
export function stripQuery(url: string): string {
  const end = url.search(/[?#]/);
  return end === -1 ? url : url.slice(0, end);
}

/** Mensagem de erro sem e-mails, sem query strings e sem números: o tipo do problema fica. */
export function scrubMessage(message: string): string {
  return message.replace(EMAIL, "[e-mail]").replace(URL_WITH_QUERY, "$1").replace(NUMBER, "#");
}

/** Pilha com as linhas da mensagem limpas; as linhas "at ..." (código, não dados) ficam. */
export function scrubStack(stack: string): string {
  return stack
    .split("\n")
    .map((line) => (STACK_FRAME.test(line) ? line : scrubMessage(line)))
    .join("\n");
}

type MutableAttributes = Record<string, unknown>;

/** Limpa, no próprio objeto, os atributos de um span ou de um evento dele. */
export function redactAttributes(attributes: MutableAttributes): void {
  for (const key of URL_ATTRIBUTES) {
    const value = attributes[key];
    if (typeof value === "string") attributes[key] = stripQuery(value);
  }
  for (const key of QUERY_ATTRIBUTES) delete attributes[key];
  const message = attributes["exception.message"];
  if (typeof message === "string") attributes["exception.message"] = scrubMessage(message);
  const stack = attributes["exception.stacktrace"];
  if (typeof stack === "string") attributes["exception.stacktrace"] = scrubStack(stack);
}

/**
 * Processador que limpa os spans antes do exportador. No início, o nome e os atributos com que
 * o span nasce (o Next e o fetch já põem a URL completa ali). No fim, o que foi gravado depois:
 * as exceções e a descrição do status, onde o Next põe a mensagem inteira do erro. O objeto ainda
 * é o mesmo que o exportador vai enviar, por isso a limpeza é feita nele, e este processador vem
 * antes do exportador na lista.
 */
export class RedactionSpanProcessor implements SpanProcessor {
  onStart(span: Span): void {
    const name = stripQuery(span.name);
    if (name !== span.name) span.updateName(name);
    redactAttributes(span.attributes as MutableAttributes);
  }

  onEnd(span: ReadableSpan): void {
    redactAttributes(span.attributes as MutableAttributes);
    for (const event of span.events) {
      if (event.attributes) redactAttributes(event.attributes as MutableAttributes);
    }
    const status = span.status as { message?: string };
    if (typeof status.message === "string") status.message = scrubMessage(status.message);
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
