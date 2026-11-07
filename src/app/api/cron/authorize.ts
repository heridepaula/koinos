import { env } from "@/shared/env";
import { matchesCronAuth } from "@/shared/lib/cron-auth";

/**
 * Confere o `Authorization` do cron: `Bearer <CRON_SECRET>` (Vercel Cron) ou Basic com o usuário
 * `cron` e `CRON_BASIC_PASSWORD` (cron-job.org).
 */
export function isCronAuthorized(header: string | null): boolean {
  return matchesCronAuth(header, {
    secret: env.CRON_SECRET,
    basicPassword: env.CRON_BASIC_PASSWORD,
  });
}
