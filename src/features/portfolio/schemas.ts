import { z } from "zod";

export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido");

export const reinvestmentPercentSchema = z.object({
  month: monthKeySchema,
  percent: z
    .number()
    .min(0, "A % não pode ser negativa")
    .max(100, "A % não pode passar de 100")
    .nullable(),
});

export type ReinvestmentPercentInput = z.infer<typeof reinvestmentPercentSchema>;
