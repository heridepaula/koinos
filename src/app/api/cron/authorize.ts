import { timingSafeEqual } from "node:crypto";
import { env } from "@/shared/env";

/** Confere o `Authorization: Bearer <CRON_SECRET>` da Vercel Cron em tempo constante. */
export function isCronAuthorized(header: string | null): boolean {
  if (!env.CRON_SECRET || !header) return false;
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
