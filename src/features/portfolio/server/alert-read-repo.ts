import "server-only";
import { Types } from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import type { AlertReadState } from "../domain/alerts";
import { AlertReadModel, type AlertReadDoc } from "./alert-read.model";

// Toda função recebe o portfolioId explícito e o usa em todos os filtros ({ portfolioId, alertId }).

const toObjectId = (id: string) => new Types.ObjectId(id);

/** A impressão vista de cada alerta desta carteira e se foi excluído (id → estado). */
export async function listAlertReads(portfolioId: string): Promise<Map<string, AlertReadState>> {
  await connectMongo();
  const docs = await AlertReadModel.find(
    { portfolioId: toObjectId(portfolioId) },
    { alertId: 1, fingerprint: 1, dismissed: 1 },
  ).lean<Pick<AlertReadDoc, "alertId" | "fingerprint" | "dismissed">[]>();
  return new Map(
    docs.map((doc) => [
      doc.alertId,
      { fingerprint: doc.fingerprint, dismissed: doc.dismissed ?? false },
    ]),
  );
}

/**
 * Marca os alertas como lidos (ou, com `dismissed`, os exclui do sino) com a impressão de agora,
 * trocando a anterior do mesmo alerta.
 */
export async function markAlertsRead(
  portfolioId: string,
  alerts: readonly { id: string; fingerprint: string }[],
  now: Date,
  dismissed = false,
): Promise<void> {
  if (alerts.length === 0) return;
  await connectMongo();
  const portfolio = toObjectId(portfolioId);
  await AlertReadModel.bulkWrite(
    alerts.map((alert) => ({
      updateOne: {
        filter: { portfolioId: portfolio, alertId: alert.id },
        update: {
          $set: { fingerprint: alert.fingerprint, dismissed, readAt: now },
          $setOnInsert: { portfolioId: portfolio, alertId: alert.id },
        },
        upsert: true,
      },
    })),
  );
}
