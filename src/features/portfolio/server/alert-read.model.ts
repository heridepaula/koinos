import "server-only";
import mongoose, { Schema, type Model, type Types } from "mongoose";

/** Um alerta que o dono marcou como lido, com a impressão que ele tinha na hora. */
export interface AlertReadDoc {
  _id: Types.ObjectId;
  portfolioId: Types.ObjectId;
  /** O id do alerta (`concentracao`, `pesos-acoes`…). */
  alertId: string;
  /** A impressão lida: quando a de agora for outra, o alerta volta a não lido. */
  fingerprint: string;
  readAt: Date;
}

const alertReadSchema = new Schema<AlertReadDoc>({
  portfolioId: { type: Schema.Types.ObjectId, required: true },
  alertId: { type: String, required: true },
  fingerprint: { type: String, required: true },
  readAt: { type: Date, required: true },
});

alertReadSchema.index({ portfolioId: 1, alertId: 1 }, { unique: true });

export const AlertReadModel: Model<AlertReadDoc> =
  (mongoose.models.AlertRead as Model<AlertReadDoc> | undefined) ??
  mongoose.model<AlertReadDoc>("AlertRead", alertReadSchema, "alert_reads");
