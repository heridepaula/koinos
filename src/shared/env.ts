import "server-only";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/** Cabeçalhos do OTLP no formato chave=valor, separados por vírgula (ex.: api-key=...). */
const otlpHeaders = (name: string) =>
  z
    .string()
    .regex(
      /^[^=,\s]+=[^,]+(,[^=,\s]+=[^,]+)*$/,
      `${name} deve ter o formato chave=valor (ex.: api-key=...)`,
    )
    .optional();

// Variáveis de ambiente do servidor, validadas na inicialização.
// Nada aqui chega ao navegador: não existe nenhuma variável NEXT_PUBLIC_.
export const env = createEnv({
  server: {
    MONGODB_URI: z
      .string()
      .regex(/^mongodb(\+srv)?:\/\//, "MONGODB_URI deve começar com mongodb:// ou mongodb+srv://"),
    REDIS_URL: z
      .string()
      .regex(/^rediss?:\/\//, "REDIS_URL deve começar com redis:// ou rediss:// (TLS)"),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    // Só para desenvolvimento local. Em produção, quem entra é definido no console do Google
    // (usuários de teste do app OAuth); sem a variável, qualquer e-mail verificado passa.
    ALLOWED_EMAILS: z.string().min(3).optional(),
    BRAPI_TOKEN: z.string().min(1).optional(),
    BRAPI_MONTHLY_QUOTA: z.coerce.number().int().positive().default(15000),
    // usebolsai (plano gratuito): VP por cota dos FIIs, para o P/VP. Sem a chave, o P/VP fica vazio.
    BOLSAI_API_KEY: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(16).optional(),
    // APM (OpenTelemetry → New Relic). O SDK lê estas variáveis direto do ambiente; aqui só o
    // formato é conferido. Sem o endpoint, nenhum span nem log sai do servidor.
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    OTEL_EXPORTER_OTLP_HEADERS: otlpHeaders("OTEL_EXPORTER_OTLP_HEADERS"),
    // Chave própria para os logs; sem ela, os logs usam a de OTEL_EXPORTER_OTLP_HEADERS.
    OTEL_EXPORTER_OTLP_LOGS_HEADERS: otlpHeaders("OTEL_EXPORTER_OTLP_LOGS_HEADERS"),
    OTEL_SERVICE_NAME: z.string().min(1).optional(),
  },
  client: {},
  experimental__runtimeEnv: {},
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});
