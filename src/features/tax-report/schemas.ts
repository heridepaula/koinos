import { z } from "zod";
import { isValidCnpj } from "./domain/cnpj";

/**
 * Saldo de prejuízo a compensar que o dono tinha antes do primeiro mês do livro-razão (nov/2019),
 * em R$ por classe. Entra no primeiro mês da apuração (`apureMonthly`), não em janeiro de um ano.
 */
export const openingLossSchema = z.object({
  fii: z.number().min(0).max(1e9),
  acao: z.number().min(0).max(1e9),
});

export const assetCnpjSchema = z.object({
  ticker: z.string().regex(/^[A-Z]{4}\d{1,2}$/),
  cnpj: z.string().refine((value) => isValidCnpj(value), "CNPJ inválido"),
});

export const generateNarrativesSchema = z.object({
  year: z.number().int().min(2019).max(2100),
});
