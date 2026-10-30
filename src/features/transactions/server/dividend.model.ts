import "server-only";
import mongoose, { Schema, type Model, type Types } from "mongoose";
import { DIVIDEND_KINDS, type DividendKind } from "../domain/types";

export interface DividendDoc {
  _id: Types.ObjectId;
  portfolioId: Types.ObjectId;
  ticker: string;
  /** Data do pagamento (a data da linha do extrato), à meia-noite UTC. */
  paidAt: Date;
  kind: DividendKind;
  amount: number;
  quantity: number | null;
  perShare: number | null;
  source: "B3";
  createdAt: Date;
  updatedAt: Date;
}

const dividendSchema = new Schema<DividendDoc>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true },
    ticker: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9]{4}\d{1,2}$/,
    },
    paidAt: { type: Date, required: true },
    kind: { type: String, required: true, enum: DIVIDEND_KINDS },
    amount: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: null },
    perShare: { type: Number, default: null },
    source: { type: String, required: true, enum: ["B3"], default: "B3" },
  },
  { timestamps: true },
);

dividendSchema.index({ portfolioId: 1, ticker: 1, paidAt: 1 });

export const DividendModel: Model<DividendDoc> =
  (mongoose.models.Dividend as Model<DividendDoc> | undefined) ??
  mongoose.model<DividendDoc>("Dividend", dividendSchema, "dividends");
