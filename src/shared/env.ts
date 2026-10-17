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
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    ALLOWED_EMAILS: z.string().min(3),
    BRAPI_TOKEN: z.string().min(1).optional(),
    BRAPI_MONTHLY_QUOTA: z.coerce.number().int().positive().default(15000),
    CRON_SECRET: z.string().min(16).optional(),
  },
  client: {},
  experimental__runtimeEnv: {},
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});
