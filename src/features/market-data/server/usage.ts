import "server-only";
import { connectMongo } from "@/shared/db/mongo";
import { env } from "@/shared/env";
import { currentMonthKey } from "@/shared/lib/time";
import { recordSpan } from "@/shared/lib/tracing";
import { ApiUsageModel } from "./models";

// Contadores duráveis (Mongo) das APIs com cota: a brapi conta por mês (mês de São Paulo) e a
// usebolsai por dia UTC, porque a cota dela zera às 0h UTC. Os spans de fetch também contam as
// chamadas, mas a New Relic guarda spans por poucos dias e um envio perdido some da conta.
const brapiKey = (now: Date) => `brapi:${currentMonthKey(now)}`;
const bolsaiKey = (now: Date) => `bolsai:${now.toISOString().slice(0, 10)}`;

async function increment(key: string): Promise<void> {
  await connectMongo();
  await ApiUsageModel.updateOne({ _id: key }, { $inc: { count: 1 } }, { upsert: true });
}

async function countOf(key: string): Promise<number> {
  await connectMongo();
  const doc = await ApiUsageModel.findById(key).lean();
  return doc?.count ?? 0;
}

/** Soma 1 requisição da brapi no mês corrente. */
export const recordBrapiRequest = (now = new Date()) => increment(brapiKey(now));

export const brapiRequestsThisMonth = (now = new Date()) => countOf(brapiKey(now));

/** Soma 1 chamada da usebolsai no dia UTC corrente. */
export const recordBolsaiRequest = (now = new Date()) => increment(bolsaiKey(now));

/**
 * Span `api.usage` com o uso de cada cota segundo os contadores do Mongo. Sai no fim de cada
 * rotina que gasta cota (cron diário, cron da usebolsai, atualização ao abrir o app), então o
 * dashboard sempre tem um valor recente. Uma falha de leitura só fica no log.
 */
export async function reportApiUsage(now = new Date()): Promise<void> {
  try {
    const [brapi, bolsai] = await Promise.all([countOf(brapiKey(now)), countOf(bolsaiKey(now))]);
    recordSpan("api.usage", {
      "koinos.api.brapi.month_requests": brapi,
      "koinos.api.brapi.month_quota": env.BRAPI_MONTHLY_QUOTA,
      "koinos.api.bolsai.day_requests": bolsai,
      "koinos.api.bolsai.day_quota": env.BOLSAI_DAILY_QUOTA,
    });
  } catch (error) {
    console.warn("[api.usage]", error instanceof Error ? error.message : String(error));
  }
}
