import "server-only";
import mongoose from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { cvmCnpjWrite, type CvmCnpjUpdate } from "../domain/asset-identity";
import { AssetModel } from "./models";

/** O que se sabe do emissor do ativo. Mesmo formato de `AssetIdentity` do relatório de IR. */
export type StoredAssetIdentity = {
  name: string | null;
  legalName: string | null;
  cnpj: string | null;
  cnpjSource: "CVM_FCA" | "CVM_ISIN" | "MANUAL" | null;
};

export async function readAssetIdentities(
  tickers: readonly string[],
): Promise<Map<string, StoredAssetIdentity>> {
  const unique = [...new Set(tickers)];
  if (unique.length === 0) return new Map();
  await connectMongo();
  const docs = await AssetModel.find(
    { _id: mongoose.trusted({ $in: unique }) },
    { name: 1, legalName: 1, cnpj: 1, cnpjSource: 1 },
  ).lean();
  return new Map(
    docs.map((doc) => [
      doc._id,
      {
        name: doc.name ?? null,
        legalName: doc.legalName ?? null,
        cnpj: doc.cnpj ?? null,
        cnpjSource: doc.cnpjSource ?? null,
      },
    ]),
  );
}

/** Grava os CNPJs que a CVM trouxe, sem tocar nos digitados pelo dono. Devolve quantos ativos casaram. */
export async function writeCvmCnpjs(updates: readonly CvmCnpjUpdate[], now: Date): Promise<number> {
  if (updates.length === 0) return 0;
  await connectMongo();
  const result = await AssetModel.bulkWrite(
    updates.map((item) => {
      const { filter, update } = cvmCnpjWrite(item, now);
      return {
        updateOne: {
          filter: { _id: filter._id, cnpjSource: mongoose.trusted(filter.cnpjSource) },
          update,
        },
      };
    }),
    { ordered: false },
  );
  return result.matchedCount;
}

/** CNPJ digitado pelo dono (`MANUAL`): vale sobre qualquer valor da CVM. Falso se o ativo não existe. */
export async function setAssetCnpj(
  ticker: string,
  cnpj: string,
  now = new Date(),
): Promise<boolean> {
  await connectMongo();
  const result = await AssetModel.updateOne(
    { _id: ticker },
    { $set: { cnpj, cnpjSource: "MANUAL", cnpjFetchedAt: now } },
  );
  return result.matchedCount > 0;
}
