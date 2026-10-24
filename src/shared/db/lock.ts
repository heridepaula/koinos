import "server-only";
import { randomUUID } from "node:crypto";
import { redis } from "@/shared/db/redis";
import { withSpan } from "@/shared/lib/tracing";

// Libera a trava só se ela ainda for nossa (comparar e apagar num único passo).
const RELEASE_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

/**
 * Executa `fn` com uma trava distribuída no Redis (SET NX PX), válida para todas as instâncias.
 * Se outra instância já estiver com a trava, não executa e devolve null.
 * O span `lock <nome>` mostra no APM quando a trava estava ocupada; o nome vai sem o id da
 * carteira ("import:<id>" vira "import").
 */
export async function withLock<T>(
  name: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const label = name.split(":")[0];
  return withSpan(`lock ${label}`, { "koinos.lock.name": label }, async (span) => {
    const key = `koinos:lock:${name}`;
    const token = randomUUID();
    const acquired = await redis.set(key, token, "PX", ttlMs, "NX");
    span.setAttribute("koinos.lock.acquired", acquired === "OK");
    if (acquired !== "OK") return null;
    try {
      return await fn();
    } finally {
      await redis.eval(RELEASE_SCRIPT, 1, key, token);
    }
  });
}
