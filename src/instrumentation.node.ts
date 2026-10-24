import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";
import { MongoDBInstrumentation } from "@opentelemetry/instrumentation-mongodb";
import { registerOTel } from "@vercel/otel";
import { RedactionSpanProcessor } from "@/shared/lib/telemetry-redaction";

// APM com OpenTelemetry. Os spans saem pelo OTLP/HTTP para o endereço de
// OTEL_EXPORTER_OTLP_ENDPOINT (a New Relic, em produção), com OTEL_EXPORTER_OTLP_HEADERS. Sem o
// endpoint (dev, CI), nada sai do processo. No serverless, o @vercel/otel espera o span raiz
// fechar e envia no waitUntil da requisição, sem atrasar a resposta.
registerOTel({
  serviceName: process.env.OTEL_SERVICE_NAME ?? "koinos",
  instrumentations: [
    // fetch global e http/https: brapi, Yahoo e Google. O contexto do trace só vai para o
    // próprio app, nunca para terceiros.
    "fetch",
    // Driver nativo, que atende o Better Auth e o Mongoose: o formato da query, com "?" no lugar
    // de cada valor. E-mails, tokens OAuth e números da carteira não saem do servidor.
    new MongoDBInstrumentation({ enhancedDatabaseReporting: false }),
    // Sessões, rate limit e travas: só o nome do comando, sem chaves nem valores.
    new IORedisInstrumentation({ dbStatementSerializer: (command) => command }),
  ],
  // A limpeza vem antes do exportador padrão ("auto", montado pelas variáveis de ambiente).
  spanProcessors: [new RedactionSpanProcessor(), "auto"],
});
