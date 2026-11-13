import {
  refreshFundamentusIndicators,
  refreshRadars,
  reportApiUsage,
} from "@/features/market-data/server";
import { listAllTargetRanks } from "@/features/strategy/server";
import { listHeldQuantities } from "@/features/transactions/server";
import { recordError, withSpan } from "@/shared/lib/tracing";
import { isCronAuthorized } from "../authorize";

export const maxDuration = 60;

const NO_INDICATORS = { updated: 0, failed: 0, pending: 0 };

/**
 * Radar de fundamentos (spec radar-fundamentos). Chamado pelo cron-job.org de 15 em 15 min, das
 * 03:00 às 06:45 (docs/operations/cron-job-org.md). Cada chamada busca até 6 páginas de
 * indicadores no Fundamentus e depois gera até 6 textos, com timeout de 8 s por chamada ao
 * Gemini e sem começar nenhuma com menos de 9 s sobrando do orçamento de 25 s (o cron-job.org corta em 30 s); o resto fica para a
 * próxima chamada.
 * Responde só contagens.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }
  const startedAt = Date.now();
  return withSpan("cron.radar", {}, async () => {
    const [held, targets] = await Promise.all([listHeldQuantities(), listAllTargetRanks()]);
    const candidates = [
      ...held.map(({ ticker, quantity }) => ({ ticker, quantity, rank: null })),
      ...targets.map(({ ticker, rank }) => ({ ticker, quantity: null, rank })),
    ];
    const tickers = [...new Set(candidates.map(({ ticker }) => ticker))];
    // Uma falha nos indicadores nunca impede o Radar: os antigos valem até 10 dias.
    const indicators = await withSpan("cron.refresh-indicators", {}, async (span) => {
      try {
        const result = await refreshFundamentusIndicators(tickers, { maxPages: 6 });
        span.setAttributes({
          "koinos.indicators.updated": result.updated,
          "koinos.indicators.failed": result.failed,
          "koinos.indicators.pending": result.pending,
        });
        return result;
      } catch (error) {
        console.warn("[indicadores]", error instanceof Error ? error.message : String(error));
        recordError(span, error);
        return NO_INDICATORS;
      }
    });
    const radar = await refreshRadars(candidates, {
      maxAssets: 6,
      deadline: startedAt + 25_000,
    });
    if (radar.geminiCalls > 0) await reportApiUsage();
    return Response.json({ indicators, radar }, { headers: { "Cache-Control": "no-store" } });
  });
}
