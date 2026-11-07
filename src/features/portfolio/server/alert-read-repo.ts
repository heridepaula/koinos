import "server-only";
import { Types } from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { AlertReadModel, type AlertReadDoc } from "./alert-read.model";

// Toda função recebe o portfolioId explícito e o usa em todos os filtros ({ portfolioId, alertId }).

const toObjectId = (id: string) => new Types.ObjectId(id);

/** A impressão lida de cada alerta desta carteira (id → impressão). */
export async function listAlertReads(portfolioId: string): Promise<Map<string, string>> {
  await connectMongo();
  const docs = await AlertReadModel.find(
    { portfolioId: toObjectId(portfolioId) },
    { alertId: 1, fingerprint: 1 },
  ).lean<Pick<AlertReadDoc, "alertId" | "fingerprint">[]>();
  return new Map(docs.map((doc) => [doc.alertId, doc.fingerprint]));
}

/** Marca os alertas como lidos com a impressão de agora (troca a anterior do mesmo alerta). */
export async function markAlertsRead(
  portfolioId: string,
  alerts: readonly { id: string; fingerprint: string }[],
  now: Date,
): Promise<void> {
  if (alerts.length === 0) return;
  await connectMongo();
  const portfolio = toObjectId(portfolioId);
  await AlertReadModel.bulkWrite(
    alerts.map((alert) => ({
      updateOne: {
        filter: { portfolioId: portfolio, alertId: alert.id },
        update: {
          $set: { fingerprint: alert.fingerprint, readAt: now },
          $setOnInsert: { portfolioId: portfolio, alertId: alert.id },
        },
        upsert: true,
      },
    })),
  );
}
