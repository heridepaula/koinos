import { syncCnpjs } from "@/features/tax-report/server";
import { cronJob } from "../job";

export const maxDuration = 60;

/**
 * Sincroniza o CNPJ dos ativos pela CVM (semanal, cron-job.org). Os ZIPs da CVM são grandes, por
 * isso a rota é própria e não faz parte do cron diário. Responde só contagens.
 */
export const GET = cronJob("cnpj", async () => {
  const { updated, unmatched } = await syncCnpjs();
  return { updated, unmatched: unmatched.length };
});
