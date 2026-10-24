import { format } from "node:util";
import { diag, DiagLogLevel } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import type { LogRecordProcessor } from "@opentelemetry/sdk-logs";
import type { SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { scrubStack } from "./telemetry-redaction";

// Logs do servidor para o APM: o que o app, o Next e as bibliotecas escrevem no console (log,
// info, warn e error) vira um log OpenTelemetry, ligado ao trace da requisição (trace.id e
// span.id), com a mesma limpeza das exceções. A saída no console continua igual (o log da Vercel
// não muda).

const BRIDGED = {
  log: { number: SeverityNumber.INFO, text: "INFO" },
  info: { number: SeverityNumber.INFO, text: "INFO" },
  warn: { number: SeverityNumber.WARN, text: "WARN" },
  error: { number: SeverityNumber.ERROR, text: "ERROR" },
} as const;
/** Segunda barreira: mensagens com cara de OpenTelemetry também não voltam como log. */
const TELEMETRY_NOISE = /opentelemetry|@vercel\/otel|otlp/i;
/** A New Relic corta mensagens muito longas; 8 mil caracteres cobrem uma pilha inteira. */
const MAX_MESSAGE_LENGTH = 8000;

/** O console de antes da ponte: o diagnóstico do OpenTelemetry escreve aqui. */
const originalConsole = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
};

/**
 * O diagnóstico do próprio OpenTelemetry (OTEL_LOG_LEVEL) passa a escrever no console original.
 * Sem isso, um envio que falhou ("connect ECONNREFUSED…") voltaria pela ponte como log, falharia
 * de novo e viraria um laço.
 */
export function keepDiagnosticsOutOfLogs(): void {
  const level = process.env.OTEL_LOG_LEVEL?.toUpperCase() as keyof typeof DiagLogLevel | undefined;
  if (!level || !(level in DiagLogLevel)) return;
  diag.setLogger(
    { ...originalConsole, verbose: originalConsole.debug },
    { logLevel: DiagLogLevel[level], suppressOverrideMessage: true },
  );
}

export function bridgeConsoleToLogs(): void {
  const logger = logs.getLogger("koinos.console");
  let emitting = false;
  for (const method of Object.keys(BRIDGED) as (keyof typeof BRIDGED)[]) {
    const write = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      write(...args);
      if (emitting) return;
      const text = format(...args);
      if (TELEMETRY_NOISE.test(text)) return;
      emitting = true;
      try {
        logger.emit({
          severityNumber: BRIDGED[method].number,
          severityText: BRIDGED[method].text,
          body: scrubStack(text).slice(0, MAX_MESSAGE_LENGTH),
          attributes: { "log.source": "console" },
        });
      } finally {
        emitting = false;
      }
    };
  }
}

/**
 * No fim de cada requisição, o @vercel/otel esvazia os processadores de span no waitUntil, antes
 * de a função congelar. Este processador não mexe nos spans: só leva junto a fila de logs.
 */
export class FlushLogsWithSpans implements SpanProcessor {
  constructor(private readonly logProcessor: LogRecordProcessor) {}

  onStart(): void {}

  onEnd(): void {}

  forceFlush(): Promise<void> {
    return this.logProcessor.forceFlush();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
