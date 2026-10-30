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

const fiiCode = z.string().regex(/^[A-Z0-9]{4}11$/);

/**
 * Respostas às pendências da importação da B3 (spec §7). Os ids são recalculados no servidor.
 * O custo da bonificação (`bon:`) aceita 0; nos outros preços, o plano ignora o que não for > 0.
 */
export const b3AnswersSchema = z.object({
  prices: z
    .record(
      z.string().regex(/^(sub|prev|bon):[A-Z0-9]{4}\d{1,2}\b/),
      z.number().min(0).max(10_000_000),
    )
    .default({}),
  conversions: z
    .record(z.string().regex(/^conv:[A-Z0-9]{4}11:/), z.union([fiiCode, z.literal("NONE")]))
    .default({}),
  exclude: z.array(z.string().regex(TICKER_REGEX)).max(200).default([]),
});

/** Formulário da importação: os arquivos, as respostas (JSON) e o "revisei as divergências". */
export const b3ImportFormSchema = z.instanceof(FormData).transform((form, ctx) => {
  const files = form
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const raw = form.get("answers");
  let answers: unknown = {};
  if (typeof raw === "string" && raw) {
    try {
      answers = JSON.parse(raw);
    } catch {
      ctx.addIssue({ code: "custom", message: "Respostas inválidas." });
      return z.NEVER;
    }
  }
  const parsed = b3AnswersSchema.safeParse(answers);
  if (!parsed.success) {
    ctx.addIssue({ code: "custom", message: "Respostas inválidas." });
    return z.NEVER;
  }
  return {
    files,
    answers: parsed.data,
    acceptDivergences: form.get("acceptDivergences") === "true",
  };
});

export type B3ImportRequest = z.output<typeof b3ImportFormSchema>;
