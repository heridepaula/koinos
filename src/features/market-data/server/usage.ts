import "server-only";
import mongoose from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { env } from "@/shared/env";
import { currentMonthKey } from "@/shared/lib/time";
import { recordSpan } from "@/shared/lib/tracing";
import { GEMINI_MODELS } from "../domain/day-insight";
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

// A cota diária do Gemini zera à meia-noite do Pacífico (documentação de rate limits).
const pacificDay = (now: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now);
const geminiKey = (model: string, now: Date) => `gemini:${model}:${pacificDay(now)}`;

/** Soma 1 chamada de um modelo do Gemini no dia (Pacífico). */
export const recordGeminiRequest = (model: string, now = new Date()) =>
  increment(geminiKey(model, now));

/** O modelo respondeu 429: conta a cota do dia como cheia, para a cadeia pular para o próximo. */
export async function markGeminiExhausted(
  model: string,
  quota: number,
  now = new Date(),
): Promise<void> {
  await connectMongo();
  await ApiUsageModel.updateOne(
    { _id: geminiKey(model, now) },
    { $max: { count: quota } },
    { upsert: true },
  );
}

/** As chamadas de hoje de cada modelo. */
export async function geminiRequestsToday(
  models: readonly string[],
  now = new Date(),
): Promise<Map<string, number>> {
  await connectMongo();
  const keys = models.map((model) => geminiKey(model, now));
  const docs = await ApiUsageModel.find({ _id: mongoose.trusted({ $in: keys }) }).lean();
  const byKey = new Map(docs.map((doc) => [doc._id, doc.count]));
  return new Map(models.map((model) => [model, byKey.get(geminiKey(model, now)) ?? 0]));
}

/**
 * Span `api.usage` com o uso de cada cota segundo os contadores do Mongo. Sai no fim de cada
 * rotina que gasta cota (cron diário, cron da usebolsai, atualização ao abrir o app), então o
 * dashboard sempre tem um valor recente. Uma falha de leitura só fica no log.
 */
export async function reportApiUsage(now = new Date()): Promise<void> {
  try {
    const [brapi, bolsai, gemini] = await Promise.all([
      countOf(brapiKey(now)),
      countOf(bolsaiKey(now)),
      geminiRequestsToday(
        GEMINI_MODELS.map((model) => model.id),
        now,
      ),
    ]);
    recordSpan("api.usage", {
      "koinos.api.brapi.month_requests": brapi,
      "koinos.api.brapi.month_quota": env.BRAPI_MONTHLY_QUOTA,
      "koinos.api.bolsai.day_requests": bolsai,
      "koinos.api.bolsai.day_quota": env.BOLSAI_DAILY_QUOTA,
      // A soma da cadeia: cada modelo tem a sua cota, e o dashboard vê o total.
      "koinos.api.gemini.day_requests": [...gemini.values()].reduce((sum, count) => sum + count, 0),
      "koinos.api.gemini.day_quota": GEMINI_MODELS.reduce(
        (sum, model) => sum + model.dailyQuota,
        0,
      ),
    });
  } catch (error) {
    console.warn("[api.usage]", error instanceof Error ? error.message : String(error));
  }
}
