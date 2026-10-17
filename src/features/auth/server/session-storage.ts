import "server-only";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { redisStorage } from "@better-auth/redis-storage";
import type Redis from "ioredis";

const KEY_PREFIX = "koinos:auth:";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Armazenamento das sessões no Redis com proteção própria, independente de TLS:
 * - a chave (que contém o token de sessão) vira um HMAC-SHA256, então o token nunca vai ao Redis;
 * - o valor (dados da sessão e do usuário) é cifrado com AES-256-GCM e autenticado.
 * As duas chaves criptográficas são derivadas do BETTER_AUTH_SECRET via HKDF.
 */
export function createProtectedSessionStorage(client: Redis, secret: string) {
  const base = redisStorage({ client, keyPrefix: KEY_PREFIX });
  const encryptionKey = Buffer.from(hkdfSync("sha256", secret, KEY_PREFIX, "aes-256-gcm", 32));
  const macKey = Buffer.from(hkdfSync("sha256", secret, KEY_PREFIX, "hmac-sha256", 32));

  const hashKey = (key: string) => createHmac("sha256", macKey).update(key).digest("base64url");

  const seal = (plaintext: string) => {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
    const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
  };

  const open = (sealed: unknown): string | null => {
    if (typeof sealed !== "string") return null;
    try {
      const raw = Buffer.from(sealed, "base64url");
      const decipher = createDecipheriv("aes-256-gcm", encryptionKey, raw.subarray(0, IV_BYTES));
      decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
      return Buffer.concat([
        decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      // Valor adulterado ou cifrado com outro segredo: trata como sessão inexistente.
      return null;
    }
  };

  return {
    get: async (key: string) => open(await base.get(hashKey(key))),
    getAndDelete: async (key: string) => open(await base.getAndDelete(hashKey(key))),
    // Contadores do rate limit: só a chave é protegida (ela contém IP e rota).
    increment: (key: string, ttl: number) => base.increment(hashKey(key), ttl),
    set: (key: string, value: string, ttl?: number) => base.set(hashKey(key), seal(value), ttl),
    delete: (key: string) => base.delete(hashKey(key)),
  };
}
