import "server-only";
import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { IndependencePlan } from "../domain/types";

export interface IndependencePlanDoc extends IndependencePlan {
  _id: Types.ObjectId;
  portfolioId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const independencePlanSchema = new Schema<IndependencePlanDoc>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true },
    answers: {
      type: new Schema(
        {
          living: { type: String, required: true },
          people: { type: String, required: true },
          health: { type: String, required: true },
          travel: { type: String, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    livingCost: { type: Number, required: true, min: 0 },
    people: { type: Number, required: true, min: 1 },
    healthPerPerson: { type: Number, required: true, min: 0 },
    travelPerYear: { type: Number, required: true, min: 0 },
    retention: { type: Number, required: true, min: 0.2, max: 1 },
  },
  { timestamps: true },
);

// Um plano por carteira.
independencePlanSchema.index({ portfolioId: 1 }, { unique: true });

export const IndependencePlanModel: Model<IndependencePlanDoc> =
  (mongoose.models.IndependencePlan as Model<IndependencePlanDoc> | undefined) ??
  mongoose.model<IndependencePlanDoc>(
    "IndependencePlan",
    independencePlanSchema,
    "independence_plans",
  );
