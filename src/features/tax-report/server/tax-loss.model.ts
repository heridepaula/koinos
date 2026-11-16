import "server-only";
import mongoose, { Schema, type Model, type Types } from "mongoose";

/**
 * Saldo de prejuízo a compensar que o dono tinha ANTES do primeiro mês do livro-razão (nov/2019),
 * um por carteira, em R$ (duas casas). É o `openingLoss` de `apureMonthly`: entra no primeiro mês
 * da apuração e corre dali em diante. Não é um saldo "de 1º de janeiro de um ano".
 */
export interface TaxLossBalanceDoc {
  _id: Types.ObjectId;
  portfolioId: Types.ObjectId;
  fii: number;
  acao: number;
  createdAt: Date;
  updatedAt: Date;
}

const taxLossBalanceSchema = new Schema<TaxLossBalanceDoc>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true },
    fii: { type: Number, required: true, min: 0 },
    acao: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

taxLossBalanceSchema.index({ portfolioId: 1 }, { unique: true });

export const TaxLossBalanceModel: Model<TaxLossBalanceDoc> =
  (mongoose.models.TaxLossBalance as Model<TaxLossBalanceDoc> | undefined) ??
  mongoose.model<TaxLossBalanceDoc>("TaxLossBalance", taxLossBalanceSchema, "tax_loss_balances");
