import "server-only";
import { ObjectId } from "mongodb";
import { connectMongo, mongoDb } from "@/shared/db/mongo";
import { PortfolioModel } from "./portfolio.model";

export async function findDefaultPortfolioId(userId: string): Promise<string | null> {
  await connectMongo();
  const doc = await PortfolioModel.findOne({ userId, isDefault: true }, { _id: 1 }).lean();
  return doc ? doc._id.toHexString() : null;
}

/** Devolve a carteira padrão do usuário, criando-a se ainda não existir. Idempotente. */
export async function ensureDefaultPortfolioId(userId: string): Promise<string> {
  const existing = await findDefaultPortfolioId(userId);
  if (existing) return existing;
  const doc = await PortfolioModel.findOneAndUpdate(
    { userId, isDefault: true },
    { $setOnInsert: { userId, isDefault: true, name: "Carteira Principal" } },
    { upsert: true, new: true, lean: true },
  );
  if (!doc) throw new Error("Falha ao criar a carteira padrão.");
  return doc._id.toHexString();
}

/** Id (string) do usuário do Better Auth com esse e-mail. Uso: scripts locais. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  await connectMongo();
  const user = await mongoDb
    .collection<{ _id: ObjectId; email: string }>("user")
    .findOne({ email: email.trim().toLowerCase() }, { projection: { _id: 1 } });
  return user ? user._id.toHexString() : null;
}
