import { z } from "zod";
import { MONTH_KEY_PATTERN } from "./domain/reinvestment";

export const monthKeySchema = z.string().regex(MONTH_KEY_PATTERN, "Mês inválido");

/** Os alertas a marcar como lidos, com a impressão que a tela mostrou. */
export const markAlertsReadSchema = z.object({
  alerts: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]{1,100}$/, "Alerta inválido"),
        fingerprint: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(50),
});

export const reinvestmentPercentSchema = z.object({
  month: monthKeySchema,
  percent: z
    .number()
    .min(0, "A % não pode ser negativa")
    .max(100, "A % não pode passar de 100")
    .nullable(),
});
