import { z } from "zod";
import { tickerSchema } from "@/features/transactions";
import { CATEGORIES } from "./domain/categories";

export const targetPatchSchema = z.object({
  ticker: tickerSchema,
  inStrategy: z.boolean().optional(),
  sunoRank: z.number().int("Use um número inteiro").min(1).max(999).nullable().optional(),
  ceilingPrice: z
    .number()
    .positive("O teto deve ser maior que zero")
    .max(1_000_000)
    .nullable()
    .optional(),
  suggestedPercent: z
    .number()
    .gt(0, "A % deve ser maior que zero")
    .max(100, "A % não pode passar de 100")
    .nullable()
    .optional(),
  category: z.enum(CATEGORIES).nullable().optional(),
});

export type TargetPatchInput = z.infer<typeof targetPatchSchema>;

export const targetTickerSchema = z.object({ ticker: tickerSchema });

/** Várias % sugeridas de uma vez (o ajuste para somar 100%). */
export const suggestedPercentsSchema = z.object({
  items: z
    .array(
      z.object({
        ticker: tickerSchema,
        suggestedPercent: z.number().gt(0).max(100),
      }),
    )
    .min(1)
    .max(200),
});
