import { refreshDayInsights } from "@/features/market-data/server";
import { listAllTargetRanks } from "@/features/strategy/server";
import { listHeldQuantities } from "@/features/transactions/server";
import { cronJob } from "../job";

export const maxDuration = 60;

/**
 * Resumo da IA das variações fortes do dia (cron-job.org, a cada 30 min, em dias úteis; a regra de
 * horários fica no domínio). Processa no máximo 3 ativos por chamada, para caber nos 30 s do
 * cron-job.org. Responde só contagens.
 */
export const GET = cronJob("day-insights", async () => {
  const [held, targets] = await Promise.all([listHeldQuantities(), listAllTargetRanks()]);
  return refreshDayInsights(
    [
      ...held.map(({ ticker, quantity }) => ({ ticker, quantity, rank: null })),
      ...targets.map(({ ticker, rank }) => ({ ticker, quantity: null, rank })),
    ],
    { maxAssets: 3 },
  );
});
