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
  // 0% é a quarentena: só vale fora da estratégia (a action confere).
  suggestedPercent: z
    .number()
    .min(0, "A % não pode ser negativa")
    .max(100, "A % não pode passar de 100")
    .nullable()
    .optional(),
  category: z.enum(CATEGORIES).nullable().optional(),
});

export type TargetPatchInput = z.infer<typeof targetPatchSchema>;

export const targetTickerSchema = z.object({ ticker: tickerSchema });

/** Adicionar pela aba da Carteira Alvo: a classe da aba tem de bater com a do ticker. */
export const addTargetSchema = z.object({
  ticker: tickerSchema,
  assetClass: z.enum(["FII", "ACAO"]),
});

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
