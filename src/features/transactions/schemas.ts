import { z } from "zod";

/** Ticker da B3: 4 caracteres + 1 ou 2 dígitos (ex.: BTLG11, PETR4, B3SA3). */
export const TICKER_REGEX = /^[A-Z0-9]{4}\d{1,2}$/;
const OBJECT_ID_REGEX = /^[a-f0-9]{24}$/i;

export const tickerSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(TICKER_REGEX, "Ticker inválido (ex.: BTLG11)");

export const transactionFormSchema = z.object({
  ticker: tickerSchema,
  type: z.enum(["BUY", "SELL"]),
  date: z.iso.date("Data inválida"),
  quantity: z
    .number("Informe a quantidade")
    .positive("A quantidade deve ser maior que zero")
    .max(1_000_000_000),
  unitPrice: z
    .number("Informe o preço")
    .positive("O preço deve ser maior que zero")
    .max(10_000_000),
  fees: z.number().min(0, "As taxas não podem ser negativas").max(10_000_000),
  notes: z.string().trim().max(500).nullable(),
});

export type TransactionFormInput = z.infer<typeof transactionFormSchema>;

export const updateTransactionSchema = transactionFormSchema.extend({
  id: z.string().regex(OBJECT_ID_REGEX, "Lançamento inválido"),
});

export const deleteTransactionSchema = z.object({
  id: z.string().regex(OBJECT_ID_REGEX, "Lançamento inválido"),
});
