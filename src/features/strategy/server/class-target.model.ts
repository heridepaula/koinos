import "server-only";
import mongoose, { Schema, type Model, type Types } from "mongoose";

/** Meta de alocação entre FIIs e ações (spec aporte por classe, §5). Uma por portfólio. */
export interface ClassTargetDoc {
  _id: Types.ObjectId;
  portfolioId: Types.ObjectId;
  fiiPercent: number;
  createdAt: Date;
  updatedAt: Date;
}

const classTargetSchema = new Schema<ClassTargetDoc>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true, unique: true },
    fiiPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      validate: { validator: Number.isInteger, message: "A % de FIIs é um número inteiro." },
    },
  },
  { timestamps: true },
);

export const ClassTargetModel: Model<ClassTargetDoc> =
  (mongoose.models.ClassTarget as Model<ClassTargetDoc> | undefined) ??
  mongoose.model<ClassTargetDoc>("ClassTarget", classTargetSchema, "class_targets");
