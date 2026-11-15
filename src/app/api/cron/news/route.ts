import {
  collectNews,
  refreshMarketIndices,
  refreshWeekSummaries,
} from "@/features/market-data/server";
import { listAllTargetRanks } from "@/features/strategy/server";
import { listHeldQuantities } from "@/features/transactions/server";
import { cronJob } from "../job";

export const maxDuration = 60;

/**
 * Notícias da semana e índices do mercado (spec 2026-11-13-noticias-e-cenario-design.md), de 30 em
 * 30 min, das 07:00 às 22:30 (cron-job.org). Lê os feeds RSS e guarda as notícias dos ativos
 * acompanhados e do cenário, mais a busca do Bing de cada ativo da Carteira Alvo (rodízio de 6 h);
 * no pregão, atualiza o Ibovespa e o IFIX. Depois, gera a leitura da semana dos ativos da Carteira
 * Alvo, no mesmo prazo de 25 s. Responde só contagens.
 */
export const GET = cronJob("news", async () => {
  const startedAt = Date.now();
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
  // A quantidade ordena as posições por valor; só a Carteira Alvo tem a leitura da semana.
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
  return { news, indices, week };
});
