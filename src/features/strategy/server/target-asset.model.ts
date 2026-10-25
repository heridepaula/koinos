import "server-only";
import mongoose, { Schema, type Model, type Types } from "mongoose";
import { CATEGORIES, type Category } from "../domain/categories";

export interface TargetAssetDoc {
  _id: Types.ObjectId;
  portfolioId: Types.ObjectId;
  ticker: string;
  inStrategy: boolean;
  sunoRank: number | null;
  ceilingPrice: number | null;
  suggestedPercent: number | null;
  category: Category | null;
  createdAt: Date;
  updatedAt: Date;
}

const targetAssetSchema = new Schema<TargetAssetDoc>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true },
    ticker: { type: String, required: true, uppercase: true, match: /^[A-Z0-9]{4}\d{1,2}$/ },
    inStrategy: { type: Boolean, required: true, default: true },
    sunoRank: { type: Number, default: null, min: 1, max: 999 },
    ceilingPrice: { type: Number, default: null, min: 0.000001 },
    // 0 é a quarentena (fora da estratégia).
    suggestedPercent: { type: Number, default: null, min: 0, max: 100 },
    category: { type: String, enum: [...CATEGORIES, null], default: null },
  },
  { timestamps: true },
);

targetAssetSchema.index({ portfolioId: 1, ticker: 1 }, { unique: true });

export const TargetAssetModel: Model<TargetAssetDoc> =
  (mongoose.models.TargetAsset as Model<TargetAssetDoc> | undefined) ??
  mongoose.model<TargetAssetDoc>("TargetAsset", targetAssetSchema, "target_assets");
