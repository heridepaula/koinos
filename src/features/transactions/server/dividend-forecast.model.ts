import "server-only";
import mongoose, { Schema, type Model, type Types } from "mongoose";
import { DIVIDEND_KINDS, type DividendKind } from "../domain/types";

// A foto do "a receber" da B3 (extrato de Eventos, spec atualizacao-b3, §2): um documento por
// carteira, trocado inteiro a cada atualização.

export interface DividendForecastItem {
  ticker: string;
  kind: DividendKind;
  /** Previsão de pagamento, à meia-noite UTC; null quando a B3 ainda não informou. */
  payDate: Date | null;
  quantity: number | null;
  perShare: number | null;
  amount: number;
}

export interface DividendForecastDoc {
  _id: Types.ObjectId;
  portfolioId: Types.ObjectId;
  /** Dia do envio dos extratos (o pregão em São Paulo, à meia-noite UTC). */
  asOf: Date;
  items: DividendForecastItem[];
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<DividendForecastItem>(
  {
    ticker: { type: String, required: true, uppercase: true, trim: true, match: /^[A-Z0-9]{4}11$/ },
    kind: { type: String, required: true, enum: DIVIDEND_KINDS },
    payDate: { type: Date, default: null },
    quantity: { type: Number, default: null },
    perShare: { type: Number, default: null },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const forecastSchema = new Schema<DividendForecastDoc>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true, unique: true },
    asOf: { type: Date, required: true },
    items: { type: [itemSchema], default: [] },
  },
  { timestamps: true },
);

export const DividendForecastModel: Model<DividendForecastDoc> =
  (mongoose.models.DividendForecast as Model<DividendForecastDoc> | undefined) ??
  mongoose.model<DividendForecastDoc>("DividendForecast", forecastSchema, "dividend_forecasts");
