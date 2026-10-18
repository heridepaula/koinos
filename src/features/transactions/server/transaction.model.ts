import "server-only";
import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  PRICE_SOURCES,
  TRANSACTION_KINDS,
  TRANSACTION_SOURCES,
  type PriceSource,
  type TransactionKind,
  type TransactionSource,
  type TransactionType,
} from "../domain/types";

export type { TransactionSource };

export interface TransactionDoc {
  _id: Types.ObjectId;
  portfolioId: Types.ObjectId;
  ticker: string;
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  fees: number;
  date: Date;
  source: TransactionSource;
  /** Ausente nos documentos antigos: vale como negócio. */
  kind?: TransactionKind;
  priceSource?: PriceSource | null;
  /** O outro lado de uma incorporação. */
  relatedTicker?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<TransactionDoc>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true },
    ticker: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9]{4}\d{1,2}$/,
    },
    type: { type: String, required: true, enum: ["BUY", "SELL"] },
    quantity: { type: Number, required: true, min: 0.000001 },
    // Desdobro entra como compra a preço 0 (o custo total não muda). O formulário exige preço > 0.
    unitPrice: { type: Number, required: true, min: 0 },
    fees: { type: Number, required: true, default: 0, min: 0 },
    date: { type: Date, required: true },
    source: { type: String, required: true, enum: TRANSACTION_SOURCES, default: "MANUAL" },
    kind: { type: String, required: true, enum: TRANSACTION_KINDS, default: "NEGOCIO" },
    priceSource: { type: String, enum: [...PRICE_SOURCES, null], default: null },
    relatedTicker: { type: String, default: null },
    notes: { type: String, maxlength: 500, default: null },
  },
  { timestamps: true },
);

transactionSchema.index({ portfolioId: 1, ticker: 1, date: 1 });
transactionSchema.index({ portfolioId: 1, date: -1 });

export const TransactionModel: Model<TransactionDoc> =
  (mongoose.models.Transaction as Model<TransactionDoc> | undefined) ??
  mongoose.model<TransactionDoc>("Transaction", transactionSchema, "transactions");
