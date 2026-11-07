import "server-only";
import mongoose, { Schema, type Model, type Types } from "mongoose";
import { EDUCATION_UNTIL_OPTIONS } from "../domain/constants";
import { HEALTH_LEVELS } from "../domain/health";
import type { IndependencePlan } from "../domain/types";

/** O documento salvo pela v2 (`version: 2`). Um da v1 não tem `version` (ver o repo). */
export interface IndependencePlanDoc extends IndependencePlan {
  _id: Types.ObjectId;
  portfolioId: Types.ObjectId;
  version: 2;
  createdAt: Date;
  updatedAt: Date;
}

const independencePlanSchema = new Schema<IndependencePlanDoc>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true },
    version: { type: Number, required: true, enum: [2] },
    currentAge: { type: Number, required: true, min: 0 },
    targetAge: { type: Number, required: true, min: 0 },
    externalWealth: { type: Number, required: true, min: 0 },
    essentialMonthly: { type: Number, required: true, min: 0 },
    seasonalYearly: { type: Number, required: true, min: 0 },
    travelYearly: { type: Number, required: true, min: 0 },
    spouseAge: { type: Number, default: null },
    dependents: { type: Number, required: true, min: 0 },
    youngestAge: { type: Number, default: null },
    educationMonthly: { type: Number, required: true, min: 0 },
    educationUntil: { type: Number, required: true, enum: [...EDUCATION_UNTIL_OPTIONS] },
    healthLevel: { type: String, required: true, enum: [...HEALTH_LEVELS] },
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
