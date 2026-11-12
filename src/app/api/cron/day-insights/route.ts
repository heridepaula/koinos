import { refreshDayInsights, reportApiUsage } from "@/features/market-data/server";
import { listAllTargetRanks } from "@/features/strategy/server";
import { listHeldQuantities } from "@/features/transactions/server";
import { withSpan } from "@/shared/lib/tracing";
import { isCronAuthorized } from "../authorize";

export const maxDuration = 60;

/**
 * Resumo da IA das variações fortes do dia. Chamado pelo cron-job.org a cada 30 min, das 10:00 às
 * 20:00 em dias úteis (docs/operations/cron-job-org.md); a regra de horários fica no domínio.
 * Processa no máximo 3 ativos por chamada, para caber nos 30 s do cron-job.org. Responde só
 * contagens.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }
  return withSpan("cron.day-insights", {}, async () => {
    const [held, targets] = await Promise.all([listHeldQuantities(), listAllTargetRanks()]);
    const summary = await refreshDayInsights(
      [
        ...held.map(({ ticker, quantity }) => ({ ticker, quantity, rank: null })),
        ...targets.map(({ ticker, rank }) => ({ ticker, quantity: null, rank })),
      ],
      { maxAssets: 3 },
    );
    if (summary.geminiCalls > 0) await reportApiUsage();
    return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
  });
}
