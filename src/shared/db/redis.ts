import "server-only";
import Redis from "ioredis";
import { env } from "@/shared/env";

// Um único client por processo (globalThis sobrevive ao HMR).
// lazyConnect: só conecta no primeiro comando, então o build não abre conexão.
const globalForRedis = globalThis as typeof globalThis & { __koinosRedis?: Redis };

function createRedis(): Redis {
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableAutoPipelining: true,
    connectionName: "koinos",
  });
  // Loga só a mensagem: o objeto de erro pode conter a URL com a senha.
  client.on("error", (error: Error) => console.error("[redis]", error.message));
  return client;
}

export const redis: Redis = (globalForRedis.__koinosRedis ??= createRedis());
