import "server-only";
import { Types } from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import type { StoredNarratives } from "../domain/narrative";
import { TaxNarrativeModel } from "./narrative.model";

// Toda função recebe o portfolioId explícito e o usa no filtro.

const toObjectId = (id: string) => new Types.ObjectId(id);

export type StoredNarrativeDoc = StoredNarratives & { model: string | null; generatedAt: Date };

/** Os textos guardados deste ano, ou null enquanto ninguém os gerou. */
export async function findNarratives(
  portfolioId: string,
  year: number,
): Promise<StoredNarrativeDoc | null> {
  await connectMongo();
  const doc = await TaxNarrativeModel.findOne({
    portfolioId: toObjectId(portfolioId),
    year,
  }).lean();
  if (!doc) return null;
  return {
    key: doc.key ?? null,
    status: doc.status,
    model: doc.model ?? null,
    generatedAt: doc.generatedAt,
    positions: doc.positions ?? {},
    codes: doc.codes ?? {},
  };
}

/** Grava o resultado de uma tentativa. Numa falha, quem chama passa os textos aceitos antes. */
export async function saveNarratives(
  portfolioId: string,
  year: number,
  doc: StoredNarrativeDoc,
): Promise<void> {
  await connectMongo();
  await TaxNarrativeModel.findOneAndUpdate(
    { portfolioId: toObjectId(portfolioId), year },
    {
      $set: {
        key: doc.key,
        status: doc.status,
        model: doc.model,
        generatedAt: doc.generatedAt,
        positions: doc.positions,
        codes: doc.codes,
      },
    },
    { upsert: true, runValidators: true },
  );
}
