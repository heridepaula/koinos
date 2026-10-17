import "server-only";
import { randomUUID } from "node:crypto";
import { redis } from "@/shared/db/redis";

// Libera a trava só se ela ainda for nossa (comparar e apagar num único passo).
const RELEASE_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

/**
 * Executa `fn` com uma trava distribuída no Redis (SET NX PX), válida para todas as instâncias.
 * Se outra instância já estiver com a trava, não executa e devolve null.
 */
export async function withLock<T>(
  name: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const key = `koinos:lock:${name}`;
  const token = randomUUID();
  const acquired = await redis.set(key, token, "PX", ttlMs, "NX");
  if (acquired !== "OK") return null;
  try {
    return await fn();
  } finally {
    await redis.eval(RELEASE_SCRIPT, 1, key, token);
  }
}
