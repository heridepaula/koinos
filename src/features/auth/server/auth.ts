import "server-only";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { mongoClient, mongoDb } from "@/shared/db/mongo";
import { redis } from "@/shared/db/redis";
import { env } from "@/shared/env";
import { isEmailAllowed, parseAllowedEmails } from "../domain/allowlist";
import { ensureDefaultPortfolioId } from "./portfolio-repo";
import { createProtectedSessionStorage } from "./session-storage";

export const allowedEmails = parseAllowedEmails(env.ALLOWED_EMAILS);

export const auth = betterAuth({
  appName: "Koinos",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL],
  // Usuários e contas no Mongo (o Atlas é replica set, então o adapter usa transações).
  database: mongodbAdapter(mongoDb, { client: mongoClient }),
  // Sessões e rate limit no Redis, com chaves em HMAC e valores cifrados (ver session-storage.ts).
  secondaryStorage: createProtectedSessionStorage(redis, env.BETTER_AUTH_SECRET),
  rateLimit: {
    enabled: true,
    storage: "secondary-storage",
    window: 60,
    max: 100,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // renova a cada 1 dia de uso
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    useSecureCookies: env.BETTER_AUTH_URL.startsWith("https://"),
  },
  databaseHooks: {
    user: {
      create: {
        // Só e-mails da allowlist, e verificados pelo Google, podem criar conta.
        before: async (user) => {
          if (!user.emailVerified || !isEmailAllowed(user.email, allowedEmails)) {
            throw new APIError("FORBIDDEN", { message: "E-mail não autorizado." });
          }
        },
        // Cada usuário nasce com a sua carteira padrão.
        after: async (user) => {
          await ensureDefaultPortfolioId(user.id);
        },
      },
    },
  },
  plugins: [nextCookies()], // precisa ser o último plugin
});
