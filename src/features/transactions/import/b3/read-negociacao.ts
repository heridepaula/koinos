import type { RowError, SheetInput } from "../parse-planilha";
import { cellText, findColumns, normalizeHeader, parseB3Date, parseB3Number } from "./cells";
import type { B3Trade, NegociacaoData } from "./types";

const SHEET = "Negociação";
const COLUMNS = {
  date: "Data do Negócio",
  type: "Tipo de Movimentação",
  market: "Mercado",
  code: "Código de Negociação",
  quantity: "Quantidade",
  price: "Preço",
};
const SPOT_MARKETS = new Set(["mercado a vista", "mercado fracionario"]);

/**
 * Extrato de Negociação: cada linha é um negócio em bolsa (compra ou venda), na data do pregão.
 * O código do fracionário (`…F`) vira o normal. "Prazo/Vencimento" é ignorado.
 */
export function readNegociacao(sheets: readonly SheetInput[]): NegociacaoData {
  const data = sheets[0]?.data ?? [];
  const columns = findColumns(data[0] ?? [], COLUMNS);
  if (!columns) {
    return {
      trades: [],
      otherMarkets: 0,
      rowErrors: [
        { sheet: SHEET, row: 1, ticker: null, message: "Cabeçalho do extrato não reconhecido." },
      ],
      firstDate: null,
      lastDate: null,
    };
  }

  const trades: B3Trade[] = [];
  const rowErrors: RowError[] = [];
  let otherMarkets = 0;
  let firstDate: Date | null = null;
  let lastDate: Date | null = null;

  data.slice(1).forEach((cells, index) => {
    const row = index + 2;
    if (cells.every((cell) => cellText(cell) === "")) return;
    const ticker = cellText(cells[columns.code])
      .toUpperCase()
      .replace(/^([A-Z0-9]{4}\d{1,2})F$/, "$1");
    const fail = (message: string) =>
      rowErrors.push({ sheet: SHEET, row, ticker: ticker || null, message });

    const date = parseB3Date(cells[columns.date]);
    if (!date) return fail(`Data inválida: "${cellText(cells[columns.date])}".`);
    if (!firstDate || date < firstDate) firstDate = date;
    if (!lastDate || date > lastDate) lastDate = date;

    if (!SPOT_MARKETS.has(normalizeHeader(cells[columns.market]))) {
      otherMarkets++;
      return;
    }
    const typeText = normalizeHeader(cells[columns.type]);
    const type = typeText === "compra" ? "BUY" : typeText === "venda" ? "SELL" : null;
    if (!type) return fail(`Tipo desconhecido: "${cellText(cells[columns.type])}".`);
    const quantity = parseB3Number(cells[columns.quantity]);
    const unitPrice = parseB3Number(cells[columns.price]);
    if (!quantity || quantity <= 0) return fail("Quantidade inválida.");
    if (!unitPrice || unitPrice <= 0) return fail("Preço inválido.");

    trades.push({ row, date, type, ticker, quantity, unitPrice });
  });

  return { trades, otherMarkets, rowErrors, firstDate, lastDate };
}
