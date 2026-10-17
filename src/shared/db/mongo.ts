import "server-only";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import { env } from "@/shared/env";

mongoose.set("strictQuery", true);
// Bloqueia injeção de operadores ($ne, $gt...) vindos de entrada não confiável.
// Operadores escritos pelo próprio código passam por mongoose.trusted().
mongoose.set("sanitizeFilter", true);

// Um único MongoClient por processo, guardado em globalThis para sobreviver ao HMR.
// O Better Auth usa o driver nativo e o Mongoose reaproveita o mesmo client.
type MongoState = { client: MongoClient; ready?: Promise<void> };
const globalForMongo = globalThis as typeof globalThis & { __koinosMongo?: MongoState };

const state: MongoState = (globalForMongo.__koinosMongo ??= {
  client: new MongoClient(env.MONGODB_URI, { appName: "koinos", maxPoolSize: 10 }),
});

export const mongoClient = state.client;
export const mongoDb = state.client.db();

/** Conecta (uma vez) e liga o Mongoose ao mesmo client. */
export function connectMongo(): Promise<void> {
  state.ready ??= (async () => {
    await state.client.connect();
    mongoose.connection.setClient(state.client);
  })().catch((error: unknown) => {
    state.ready = undefined;
    throw error;
  });
  return state.ready;
}
