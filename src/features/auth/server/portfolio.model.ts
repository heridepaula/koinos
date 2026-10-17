import "server-only";
import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface PortfolioDoc {
  _id: Types.ObjectId;
  userId: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const portfolioSchema = new Schema<PortfolioDoc>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, default: "Carteira Principal", maxlength: 80 },
    isDefault: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

// No máximo uma carteira padrão por usuário.
portfolioSchema.index(
  { userId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
);

export const PortfolioModel: Model<PortfolioDoc> =
  (mongoose.models.Portfolio as Model<PortfolioDoc> | undefined) ??
  mongoose.model<PortfolioDoc>("Portfolio", portfolioSchema, "portfolios");
