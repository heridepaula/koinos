import "server-only";
import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface ReinvestmentDoc {
  _id: Types.ObjectId;
  portfolioId: Types.ObjectId;
  /** AAAA-MM */
  month: string;
  /** % dos proventos do mês que foi reinvestida, de 0 a 100. */
  percent: number;
  createdAt: Date;
  updatedAt: Date;
}

const reinvestmentSchema = new Schema<ReinvestmentDoc>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    percent: { type: Number, required: true, min: 0, max: 100 },
  },
  { timestamps: true },
);

reinvestmentSchema.index({ portfolioId: 1, month: 1 }, { unique: true });

export const ReinvestmentModel: Model<ReinvestmentDoc> =
  (mongoose.models.Reinvestment as Model<ReinvestmentDoc> | undefined) ??
  mongoose.model<ReinvestmentDoc>("Reinvestment", reinvestmentSchema, "reinvestments");
