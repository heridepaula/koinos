import { collectNews, refreshMarketIndices } from "@/features/market-data/server";
import { listAllTargetRanks } from "@/features/strategy/server";
import { listHeldQuantities } from "@/features/transactions/server";
import { withSpan } from "@/shared/lib/tracing";
import { isCronAuthorized } from "../authorize";

export const maxDuration = 60;

/**
 * Notícias da semana e índices do mercado (spec 2026-11-13-noticias-e-cenario-design.md).
 * Chamado pelo cron-job.org de 30 em 30 min, das 07:00 às 22:30, todo dia
 * (docs/operations/cron-job-org.md). Lê os feeds RSS e guarda as notícias dos ativos
 * acompanhados e do cenário; no pregão, atualiza o Ibovespa e o IFIX. Responde só contagens.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }
  const startedAt = Date.now();
  return withSpan("cron.news", {}, async () => {
    const [held, targets] = await Promise.all([listHeldQuantities(), listAllTargetRanks()]);
    const tickers = [
      ...new Set([...held.map(({ ticker }) => ticker), ...targets.map(({ ticker }) => ticker)]),
    ];
    const [news, indices] = await Promise.all([
      collectNews(tickers, { deadline: startedAt + 25_000 }),
      refreshMarketIndices(),
    ]);
    return Response.json({ news, indices }, { headers: { "Cache-Control": "no-store" } });
  });
}
