import {
  collectNews,
  refreshMarketIndices,
  refreshWeekSummaries,
  reportApiUsage,
} from "@/features/market-data/server";
import { listAllTargetRanks } from "@/features/strategy/server";
import { listHeldQuantities } from "@/features/transactions/server";
import { withSpan } from "@/shared/lib/tracing";
import { isCronAuthorized } from "../authorize";

export const maxDuration = 60;

/**
 * Notícias da semana e índices do mercado (spec 2026-11-13-noticias-e-cenario-design.md).
 * Chamado pelo cron-job.org de 30 em 30 min, das 07:00 às 22:30, todo dia
 * (docs/operations/cron-job-org.md). Lê os feeds RSS e guarda as notícias dos ativos
 * acompanhados e do cenário, mais a busca do Bing de cada ativo da Carteira Alvo (rodízio de 6 h);
 * no pregão, atualiza o Ibovespa e o IFIX. Depois da coleta, gera a leitura da semana dos ativos da
 * Carteira Alvo (spec 2026-11-13-leitura-da-semana-design.md), no mesmo prazo de 25 s. Responde só
 * contagens.
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
    const deadline = startedAt + 25_000;
    const [news, indices] = await Promise.all([
      // A busca do Bing por ativo é só da Carteira Alvo, que é quem tem a leitura da semana.
      collectNews(tickers, { deadline, targets: targets.map(({ ticker }) => ticker) }),
      refreshMarketIndices(),
    ]);
    // Só a Carteira Alvo tem o resumo da semana; a quantidade ordena as posições por valor.
    const quantities = new Map<string, number>();
    for (const { ticker, quantity } of held) {
      quantities.set(ticker, (quantities.get(ticker) ?? 0) + quantity);
    }
    const week = await refreshWeekSummaries(
      targets.map(({ ticker, rank }) => ({
        ticker,
        rank,
        quantity: quantities.get(ticker) ?? null,
      })),
      { deadline },
    );
    if (week.geminiCalls > 0) await reportApiUsage();
    return Response.json({ news, indices, week }, { headers: { "Cache-Control": "no-store" } });
  });
}
