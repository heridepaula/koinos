import "server-only";
import mongoose, { Schema, type Model, type Types } from "mongoose";

/**
 * Os textos do Gemini do relatório de IR de um ano, um documento por carteira e ano. `key` é a
 * chave (sha256) dos dados com que os textos foram gerados; `status` é o da última tentativa: uma
 * falha mantém os textos aceitos antes. Nunca guarda o que o modelo devolveu e foi recusado.
 */
export interface TaxNarrativeDoc {
  _id: Types.ObjectId;
  portfolioId: Types.ObjectId;
  year: number;
  key: string | null;
  status: "ok" | "failed";
  model: string | null;
  generatedAt: Date;
  /** ticker → reescrita da discriminação. */
  positions: Record<string, string>;
  /** código do achado → narrativa sem número. */
  codes: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const taxNarrativeSchema = new Schema<TaxNarrativeDoc>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true },
    year: { type: Number, required: true },
    key: { type: String, default: null },
    status: { type: String, enum: ["ok", "failed"], required: true },
    model: { type: String, default: null },
    generatedAt: { type: Date, required: true },
    positions: { type: Schema.Types.Mixed, default: {} },
    codes: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false },
);

taxNarrativeSchema.index({ portfolioId: 1, year: 1 }, { unique: true });

export const TaxNarrativeModel: Model<TaxNarrativeDoc> =
  (mongoose.models.TaxNarrative as Model<TaxNarrativeDoc> | undefined) ??
  mongoose.model<TaxNarrativeDoc>("TaxNarrative", taxNarrativeSchema, "tax_narratives");
