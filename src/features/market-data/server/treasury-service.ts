import "server-only";
import { connectMongo } from "@/shared/db/mongo";
import { withLock } from "@/shared/db/lock";
import { parseTradeDate } from "@/shared/lib/time";
import { fetchTreasuryCatalog, fetchTreasuryCsv } from "../adapters/tesouro-transparente";
import {
  daysSince,
  parseTreasuryCsv,
  TRACKED_TITLES,
  trackedTitlesKey,
  treasuryRowId,
} from "../domain/treasury-rates";
import { TreasuryRateModel, TreasurySyncModel } from "./models";

const SYNC_ID = "tesouro-transparente";

export type TreasurySyncResult =
  | { status: "not-modified"; upserted: 0; baseDateAgeDays: number | null }
  | { status: "updated"; upserted: number; baseDateAgeDays: number }
  | { status: "busy"; upserted: 0; baseDateAgeDays: null };

/**
 * Sincroniza as taxas dos títulos acompanhados (spec 2026-11-01-taxa-ntnb-design.md). Pergunta ao
 * catálogo o `last_modified`; se não mudou, termina sem baixar. Senão faz um GET condicional pelo
 * ETag e, com um arquivo novo, valida tudo antes de escrever: arquivo recusado ou mais velho que
 * o dado gravado lança erro e não muda nada. Idempotente: a escrita é um upsert por (título, dia).
 */
export async function syncTreasuryRates(now = new Date()): Promise<TreasurySyncResult> {
  // Duas execuções ao mesmo tempo poderiam regredir o estado; a segunda só avisa que está ocupado.
  const result = await withLock("treasury", 120_000, () => runSync(now));
  return result ?? { status: "busy", upserted: 0, baseDateAgeDays: null };
}

async function runSync(now: Date): Promise<TreasurySyncResult> {
  await connectMongo();
  const state = await TreasurySyncModel.findById(SYNC_ID).lean();
  const lastBaseDate = state?.lastBaseDate ?? null;
  // Título novo na lista (ou estado antigo, sem a chave): sem atalhos, e grava o histórico inteiro.
  const titlesKey = trackedTitlesKey();
  const sameTitles = state?.titlesKey === titlesKey;

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
  if (sameTitles && lastBaseDate && state?.lastModified === catalog.lastModified) {
    return notModified(catalog.lastModified);
  }

  const file = await fetchTreasuryCsv(catalog.url, sameTitles ? (state?.etag ?? null) : null);
  if (file.status === "not-modified") return notModified(catalog.lastModified);

  const parsed = parseTreasuryCsv(file.text, TRACKED_TITLES);
  if (!parsed.ok) throw new Error(`Arquivo do Tesouro Transparente recusado: ${parsed.reason}`);
  if (lastBaseDate && parsed.latestBaseDate < lastBaseDate) {
    throw new Error(
      `Arquivo do Tesouro Transparente mais velho que o dado gravado (${parsed.latestBaseDate} < ${lastBaseDate})`,
    );
  }

  // Com os mesmos títulos, o último dia gravado entra de novo (upsert inofensivo que corrige uma
  // republicação só dele). Com títulos novos, entra o histórico inteiro, como no primeiro uso.
  const fresh =
    sameTitles && lastBaseDate
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
        titlesKey,
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
