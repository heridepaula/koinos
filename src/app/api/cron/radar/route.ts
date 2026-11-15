import { refreshFundamentusIndicators, refreshRadars } from "@/features/market-data/server";
import { listAllTargetSignals } from "@/features/strategy/server";
import { listHeldQuantities } from "@/features/transactions/server";
import { recordError, withSpan } from "@/shared/lib/tracing";
import { cronJob } from "../job";

export const maxDuration = 60;

const NO_INDICATORS = { updated: 0, failed: 0, pending: 0 };

/**
 * Radar de fundamentos (spec 2026-11-12-radar-fundamentos-design.md), de 15 em 15 min, das 03:00 às
 * 06:45 (cron-job.org). Cada chamada lê até 6 páginas de indicadores no Fundamentus e depois gera
 * as teses (spec 2026-11-13-tese-do-ativo-design.md), com timeout de 8 s por chamada ao Gemini e
 * sem começar nenhuma com menos de 9 s do orçamento de 25 s (o cron-job.org corta em 30 s). O resto
 * fica para a próxima chamada. Responde só contagens.
 */
export const GET = cronJob("radar", async () => {
  const startedAt = Date.now();
  const [held, targets] = await Promise.all([listHeldQuantities(), listAllTargetSignals()]);
  const candidates = [
    ...held.map(({ ticker, quantity }) => ({ ticker, quantity, rank: null })),
    ...targets.map(({ ticker, rank }) => ({ ticker, quantity: null, rank })),
  ];
  const tickers = [...new Set(candidates.map(({ ticker }) => ticker))];
  // Uma falha nos indicadores nunca impede o Radar: os antigos valem até 10 dias.
  const indicators = await withSpan("cron.refresh-indicators", {}, async (span) => {
    try {
      const result = await refreshFundamentusIndicators(tickers, {
        maxPages: 6,
        deadline: startedAt + 8_000,
      });
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
    targets,
  });
  return { indicators, radar };
});
