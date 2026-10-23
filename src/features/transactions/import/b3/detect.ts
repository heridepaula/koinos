import type { SheetInput } from "../parse-planilha";
import { normalizeHeader } from "./cells";
import type { B3FileKind } from "./types";

const has = (header: readonly unknown[], ...names: string[]) => {
  const normalized = new Set(header.map(normalizeHeader));
  return names.every((name) => normalized.has(normalizeHeader(name)));
};

/** Reconhece o arquivo pelo cabeçalho (nunca pelo nome). */
export function detectB3File(sheets: readonly SheetInput[]): B3FileKind | null {
  const header = sheets[0]?.data[0] ?? [];
  if (has(header, "Data do Negócio", "Tipo de Movimentação", "Código de Negociação")) {
    return "NEGOCIACAO";
  }
  if (has(header, "Entrada/Saída", "Movimentação", "Produto", "Quantidade")) {
    return "MOVIMENTACAO";
  }
  if (has(header, "Produto", "Tipo de Evento", "Previsão de pagamento")) {
    return "EVENTOS";
  }
  const names = sheets.map((sheet) => normalizeHeader(sheet.sheet));
  if (names.includes("movimentacoes") && names.some((name) => name.startsWith("graficos"))) {
    return "PLANILHA";
  }
  return null;
}
