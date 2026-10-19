import { parseNumberInput } from "@/shared/lib/parse-number";
import type { B3ImportPreview } from "../../import/b3/types";

/** O que o usuário respondeu na tela (os preços como texto, do jeito que foram digitados). */
export type AnswersDraft = {
  prices: Record<string, string>;
  conversions: Record<string, string>;
  exclude: string[];
  acceptDivergences: boolean;
};

export const emptyDraft = (): AnswersDraft => ({
  prices: {},
  conversions: {},
  exclude: [],
  acceptDivergences: false,
});

/**
 * Respostas para o servidor. Só vão os preços digitados (um preço já guardado continua com a
 * origem dele, "estimado" inclusive); a conversão sem escolha vai com a sugestão marcada na tela.
 */
export function toAnswers(draft: AnswersDraft, preview: B3ImportPreview | null) {
  const prices: Record<string, number> = {};
  for (const [id, text] of Object.entries(draft.prices)) {
    const value = parseNumberInput(text);
    if (Number.isFinite(value) && value > 0) prices[id] = value;
  }
  const conversions: Record<string, string> = {};
  for (const item of preview?.pending ?? []) {
    if (item.type !== "CONVERSAO") continue;
    const chosen = draft.conversions[item.id] ?? item.source ?? item.suggestion;
    if (chosen) conversions[item.id] = chosen;
  }
  return { prices, conversions, exclude: draft.exclude };
}
