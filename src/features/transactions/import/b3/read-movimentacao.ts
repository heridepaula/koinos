import type { RowError, SheetInput } from "../parse-planilha";
import { cellText, findColumns, normalizeHeader, parseB3Date, parseB3Number } from "./cells";
import type { MovementRow, MovimentacaoData } from "./types";

const SHEET = "Movimentação";
const COLUMNS = {
  direction: "Entrada/Saída",
  date: "Data",
  kind: "Movimentação",
  product: "Produto",
  quantity: "Quantidade",
  price: "Preço unitário",
  value: "Valor da Operação",
};

/**
 * Extrato de Movimentação: todas as linhas, normalizadas e sem interpretação.
 * Quem decide o que cada tipo de linha significa é o plano (`plan.ts`).
 */
export function readMovimentacao(sheets: readonly SheetInput[]): MovimentacaoData {
  const data = sheets[0]?.data ?? [];
  const columns = findColumns(data[0] ?? [], COLUMNS);
  if (!columns) {
    return {
      rows: [],
      rowErrors: [
        { sheet: SHEET, row: 1, ticker: null, message: "Cabeçalho do extrato não reconhecido." },
      ],
      firstDate: null,
      lastDate: null,
    };
  }

  const rows: MovementRow[] = [];
  const rowErrors: RowError[] = [];
  let firstDate: Date | null = null;
  let lastDate: Date | null = null;

  data.slice(1).forEach((cells, index) => {
    const row = index + 2;
    if (cells.every((cell) => cellText(cell) === "")) return;
    const code = cellText(cells[columns.product]).split(" - ")[0]!.trim().toUpperCase();
    const date = parseB3Date(cells[columns.date]);
    if (!date) {
      rowErrors.push({ sheet: SHEET, row, ticker: code || null, message: "Data inválida." });
      return;
    }
    if (!firstDate || date < firstDate) firstDate = date;
    if (!lastDate || date > lastDate) lastDate = date;
    rows.push({
      row,
      credit: normalizeHeader(cells[columns.direction]) === "credito",
      date,
      kind: cellText(cells[columns.kind]),
      code,
      quantity: parseB3Number(cells[columns.quantity]),
      unitPrice: parseB3Number(cells[columns.price]),
      value: parseB3Number(cells[columns.value]),
    });
  });

  return { rows, rowErrors, firstDate, lastDate };
}
