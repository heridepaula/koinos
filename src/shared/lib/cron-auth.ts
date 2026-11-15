import { createHash, timingSafeEqual } from "node:crypto";

/** Usuário fixo do HTTP Basic do cron-job.org: só a senha é segredo. */
export const CRON_BASIC_USER = "cron";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Quem chama o cron: `Basic base64("cron:<senha>")`, o campo de autenticação HTTP do cron-job.org,
 * único agendador dos jobs. Compara em tempo constante e fecha tudo sem senha configurada.
 */
export function matchesCronAuth(
  header: string | null | undefined,
  password: string | undefined,
): boolean {
  if (!header || !password) return false;
  const expected = `Basic ${Buffer.from(`${CRON_BASIC_USER}:${password}`).toString("base64")}`;
  return timingSafeEqual(digest(header), digest(expected));
}
