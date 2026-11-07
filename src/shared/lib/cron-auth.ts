import { createHash, timingSafeEqual } from "node:crypto";

/** Usuário fixo do HTTP Basic do cron-job.org: só a senha é segredo. */
export const CRON_BASIC_USER = "cron";

const digest = (value: string) => createHash("sha256").update(value).digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

/**
 * Quem chama o cron: `Bearer <CRON_SECRET>` (Vercel Cron) ou `Basic base64("cron:<senha>")`
 * (cron-job.org, campo de autenticação HTTP). Compara em tempo constante e fecha tudo quando
 * nenhum segredo está configurado.
 */
export function matchesCronAuth(
  header: string | null | undefined,
  secrets: { secret?: string | undefined; basicPassword?: string | undefined },
): boolean {
  if (!header) return false;
  const bearer = secrets.secret ? same(header, `Bearer ${secrets.secret}`) : false;
  const basic = secrets.basicPassword
    ? same(
        header,
        `Basic ${Buffer.from(`${CRON_BASIC_USER}:${secrets.basicPassword}`).toString("base64")}`,
      )
    : false;
  return bearer || basic;
}
