import "server-only";
import { connectMongo } from "@/shared/db/mongo";
import { currentMonthKey } from "@/shared/lib/time";
import { ApiUsageModel } from "./models";

const brapiKey = (now: Date) => `brapi:${currentMonthKey(now)}`;

/** Soma 1 requisição da brapi no mês corrente (contador durável, no Mongo). */
export async function recordBrapiRequest(now = new Date()): Promise<void> {
  await connectMongo();
  await ApiUsageModel.updateOne({ _id: brapiKey(now) }, { $inc: { count: 1 } }, { upsert: true });
}

export async function brapiRequestsThisMonth(now = new Date()): Promise<number> {
  await connectMongo();
  const doc = await ApiUsageModel.findById(brapiKey(now)).lean();
  return doc?.count ?? 0;
}
