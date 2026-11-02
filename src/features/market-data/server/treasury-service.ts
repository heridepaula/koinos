import "server-only";
import { connectMongo } from "@/shared/db/mongo";
import { parseTradeDate } from "@/shared/lib/time";
import { fetchTreasuryCatalog, fetchTreasuryCsv } from "../adapters/tesouro-transparente";
import {
  daysSince,
  parseTreasuryCsv,
  TRACKED_TITLES,
  treasuryRowId,
} from "../domain/treasury-rates";
import { TreasuryRateModel, TreasurySyncModel } from "./models";

const SYNC_ID = "tesouro-transparente";

export type TreasurySyncResult =
  | { status: "not-modified"; upserted: 0; baseDateAgeDays: number | null }
  | { status: "updated"; upserted: number; baseDateAgeDays: number };

/**
 * Sincroniza as taxas dos títulos acompanhados (spec 2026-11-01-taxa-ntnb-design.md). Pergunta ao
 * catálogo o `last_modified`; se não mudou, termina sem baixar. Senão faz um GET condicional pelo
 * ETag e, com um arquivo novo, valida tudo antes de escrever: arquivo recusado ou mais velho que
 * o dado gravado lança erro e não muda nada. Idempotente: a escrita é um upsert por (título, dia).
 */
export async function syncTreasuryRates(now = new Date()): Promise<TreasurySyncResult> {
  await connectMongo();
  const state = await TreasurySyncModel.findById(SYNC_ID).lean();
  const lastBaseDate = state?.lastBaseDate ?? null;

  const notModified = async (lastModified: string): Promise<TreasurySyncResult> => {
    await TreasurySyncModel.updateOne(
      { _id: SYNC_ID },
      { $set: { lastModified, checkedAt: now } },
      { upsert: true },
    );
    return {
      status: "not-modified",
      upserted: 0,
      baseDateAgeDays: lastBaseDate ? daysSince(lastBaseDate, now) : null,
    };
  };

  const catalog = await fetchTreasuryCatalog();
  if (lastBaseDate && state?.lastModified === catalog.lastModified) {
    return notModified(catalog.lastModified);
  }

  const file = await fetchTreasuryCsv(catalog.url, state?.etag ?? null);
  if (file.status === "not-modified") return notModified(catalog.lastModified);

  const parsed = parseTreasuryCsv(file.text, TRACKED_TITLES);
  if (!parsed.ok) throw new Error(`Arquivo do Tesouro Transparente recusado: ${parsed.reason}`);
  if (lastBaseDate && parsed.latestBaseDate < lastBaseDate) {
    throw new Error(
      `Arquivo do Tesouro Transparente mais velho que o dado gravado (${parsed.latestBaseDate} < ${lastBaseDate})`,
    );
  }

  // O dia já gravado entra de novo: é um upsert inofensivo e corrige uma republicação.
  const fresh = lastBaseDate
    ? parsed.rows.filter((row) => row.baseDate >= lastBaseDate)
    : parsed.rows;
  if (fresh.length > 0) {
    await TreasuryRateModel.bulkWrite(
      fresh.map((row) => ({
        updateOne: {
          filter: { _id: treasuryRowId(row) },
          update: {
            $set: {
              kind: row.kind,
              maturity: row.maturity,
              baseDate: parseTradeDate(row.baseDate),
              buyRate: row.buyRate,
              sellRate: row.sellRate,
              buyPrice: row.buyPrice,
              sellPrice: row.sellPrice,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
  // O estado só avança depois das linhas: se a escrita falhar, a próxima execução tenta de novo.
  await TreasurySyncModel.updateOne(
    { _id: SYNC_ID },
    {
      $set: {
        lastModified: catalog.lastModified,
        etag: file.etag,
        lastBaseDate: parsed.latestBaseDate,
        checkedAt: now,
      },
    },
    { upsert: true },
  );
  return {
    status: "updated",
    upserted: fresh.length,
    baseDateAgeDays: daysSince(parsed.latestBaseDate, now),
  };
}
