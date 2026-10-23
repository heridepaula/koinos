import { z } from "zod";
import { MONTH_KEY_PATTERN } from "./domain/reinvestment";

export const monthKeySchema = z.string().regex(MONTH_KEY_PATTERN, "Mês inválido");

export const reinvestmentPercentSchema = z.object({
  month: monthKeySchema,
  percent: z
    .number()
    .min(0, "A % não pode ser negativa")
    .max(100, "A % não pode passar de 100")
    .nullable(),
});
