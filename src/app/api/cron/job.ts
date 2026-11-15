import type { Span } from "@opentelemetry/api";
import { reportApiUsage } from "@/features/market-data/server";
import { env } from "@/shared/env";
import { matchesCronAuth } from "@/shared/lib/cron-auth";
import { withSpan } from "@/shared/lib/tracing";

/**
 * Casca de todo job de `/api/cron/*`, chamado pelo cron-job.org (HTTP Basic, `CRON_BASIC_PASSWORD`):
 * confere a autenticação, abre o span `cron.<nome>`, roda o job, registra o uso das APIs e responde
 * só contagens, sem cache. Uma falha propaga e vira 500, e o cron-job.org marca a execução como
 * falha.
 */
export function cronJob<T>(name: string, run: (span: Span) => Promise<T>) {
  return async function GET(request: Request): Promise<Response> {
    if (!matchesCronAuth(request.headers.get("authorization"), env.CRON_BASIC_PASSWORD)) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }
    return withSpan(`cron.${name}`, {}, async (span) => {
      const body = await run(span);
      await reportApiUsage();
      return Response.json(body, { headers: { "Cache-Control": "no-store" } });
    });
  };
}
