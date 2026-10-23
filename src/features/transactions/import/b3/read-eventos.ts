import type { RowError, SheetInput } from "../parse-planilha";
import { cellText, findColumns, parseB3Date, parseB3Number } from "./cells";
import type { EventoRow, EventosData } from "./types";

const SHEET = "Proventos a Receber";
const COLUMNS = {
  product: "Produto",
  eventType: "Tipo de Evento",
  payDate: "Previsão de pagamento",
  quantity: "Quantidade",
  price: "Preço unitário",
  value: "Valor líquido",
};

/**
 * Extrato de Eventos ("Proventos a Receber"): o que a B3 já anunciou e ainda não pagou.
 * Lê todas as linhas, sem interpretar; quem decide o que entra é o plano (`plan.ts`).
 * A última linha ("Total líquido") não tem produto e fica de fora.
 */
export function readEventos(sheets: readonly SheetInput[]): EventosData {
  const data = sheets[0]?.data ?? [];
  const columns = findColumns(data[0] ?? [], COLUMNS);
  if (!columns) {
    return {
      rows: [],
      rowErrors: [
        { sheet: SHEET, row: 1, ticker: null, message: "Cabeçalho do extrato não reconhecido." },
      ],
    };
  }

  const rows: EventoRow[] = [];
  const rowErrors: RowError[] = [];
  data.slice(1).forEach((cells, index) => {
    const row = index + 2;
    const product = cellText(cells[columns.product]);
    if (!product) return; // linha vazia ou o "Total líquido"
    const code = product.split(" - ")[0]!.trim().toUpperCase();
    // "-" é a B3 dizendo que ainda não há data; outro texto que não é data vira aviso.
    const payText = cellText(cells[columns.payDate]);
    const payDate = parseB3Date(cells[columns.payDate]);
    if (!payDate && payText !== "" && payText !== "-") {
      rowErrors.push({ sheet: SHEET, row, ticker: code, message: `Data inválida: "${payText}".` });
    }
    rows.push({
      row,
      code,
      eventType: cellText(cells[columns.eventType]),
      payDate,
      quantity: parseB3Number(cells[columns.quantity]),
      unitPrice: parseB3Number(cells[columns.price]),
      value: parseB3Number(cells[columns.value]),
    });
  });
  return { rows, rowErrors };
}
