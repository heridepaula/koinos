import "server-only";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

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
    CRON_SECRET: z.string().min(16).optional(),
    // APM (OpenTelemetry → New Relic). O SDK lê estas variáveis direto do ambiente; aqui só o
    // formato é conferido. Sem o endpoint, nenhum span sai do servidor.
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    OTEL_EXPORTER_OTLP_HEADERS: z
      .string()
      .regex(
        /^[^=,\s]+=[^,]+(,[^=,\s]+=[^,]+)*$/,
        "OTEL_EXPORTER_OTLP_HEADERS deve ter o formato chave=valor (ex.: api-key=...)",
      )
      .optional(),
    OTEL_SERVICE_NAME: z.string().min(1).optional(),
  },
  client: {},
  experimental__runtimeEnv: {},
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});
