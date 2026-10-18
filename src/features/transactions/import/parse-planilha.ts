import { TICKER_REGEX } from "../schemas";
import type { TransactionType } from "../domain/types";

// Lê as abas da planilha do usuário (export do Google Sheets):
// - "Movimentações": DATA, PAPEL, TIPO, QUANTIDADE, VALOR, TOTAL (cabeçalho na linha 1);
// - "Encerradas": mesmas colunas A–F, sem cabeçalho, em blocos por ativo;
// - "Gráficos": PAPEL, Rank, QTD., PRÇ. TETO (Rank 99 = fora da estratégia).

export type SheetInput = { sheet: string; data: readonly (readonly unknown[])[] };

export type ParsedTransaction = {
  sheet: string;
  /** Linha na planilha (1 = primeira linha). */
  row: number;
  ticker: string;
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  date: Date;
};

export type ParsedTarget = {
  ticker: string;
  rank: number | null;
  ceiling: number | null;
  sheetQuantity: number | null;
};

export type RowError = { sheet: string; row: number; ticker: string | null; message: string };

export type ParsedPlanilha = {
  transactions: ParsedTransaction[];
  targets: ParsedTarget[];
  rowErrors: RowError[];
};

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

function parseMovementRow(
  sheet: string,
  rowNumber: number,
  row: readonly unknown[],
): ParsedTransaction | RowError {
  const [date, rawTicker, rawKind, rawQuantity, rawPrice] = row;
  const ticker = typeof rawTicker === "string" ? rawTicker.trim().toUpperCase() : null;
  const fail = (message: string): RowError => ({ sheet, row: rowNumber, ticker, message });
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return fail("data inválida");
  if (!ticker || !TICKER_REGEX.test(ticker)) return fail("ticker inválido");
  const kind = typeof rawKind === "string" ? normalize(rawKind) : "";
  if (kind !== "compra" && kind !== "venda") return fail(`tipo desconhecido "${String(rawKind)}"`);
  if (typeof rawQuantity !== "number" || rawQuantity === 0) return fail("quantidade inválida");
  if (typeof rawPrice !== "number" || rawPrice <= 0) return fail("preço inválido");
  return {
    sheet,
    row: rowNumber,
    ticker,
    type: kind === "compra" ? "BUY" : "SELL",
    quantity: Math.abs(rawQuantity),
    unitPrice: rawPrice,
    // A planilha guarda a data à meia-noite UTC: é a própria data de negócio.
    date: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())),
  };
}

function parseTargets(sheet: SheetInput): ParsedTarget[] {
  const headerIndex = sheet.data.findIndex((row) =>
    row.some((cell) => typeof cell === "string" && normalize(cell) === "papel"),
  );
  if (headerIndex < 0) return [];
  const header = sheet.data[headerIndex]!.map((cell) =>
    typeof cell === "string" ? normalize(cell) : "",
  );
  const column = (name: string) => header.indexOf(name);
  const tickerCol = column("papel");
  const rankCol = column("rank");
  const quantityCol = column("qtd.");
  const ceilingCol = column("prc. teto");

  const targets: ParsedTarget[] = [];
  for (const row of sheet.data.slice(headerIndex + 1)) {
    const ticker =
      typeof row[tickerCol] === "string" ? String(row[tickerCol]).trim().toUpperCase() : "";
    if (!TICKER_REGEX.test(ticker)) continue;
    const number = (index: number) =>
      index >= 0 && typeof row[index] === "number" ? (row[index] as number) : null;
    const ceiling = number(ceilingCol);
    targets.push({
      ticker,
      rank: number(rankCol),
      ceiling: ceiling !== null && ceiling > 0 ? ceiling : null,
      sheetQuantity: number(quantityCol),
    });
  }
  return targets;
}

export function parsePlanilha(sheets: readonly SheetInput[]): ParsedPlanilha {
  const transactions: ParsedTransaction[] = [];
  const rowErrors: RowError[] = [];
  let targets: ParsedTarget[] = [];

  for (const sheet of sheets) {
    const name = normalize(sheet.sheet);
    if (name.startsWith("graficos")) {
      targets = parseTargets(sheet);
      continue;
    }
    const isMovements = name.startsWith("movimentacoes");
    const isClosed = name.startsWith("encerradas");
    if (!isMovements && !isClosed) continue;

    sheet.data.forEach((row, index) => {
      const rowNumber = index + 1;
      if (isMovements && index === 0) return; // cabeçalho
      // Linhas vazias e subtotais (sem data ou sem tipo) são ignoradas.
      if (!(row[0] instanceof Date) || typeof row[2] !== "string") return;
      const parsed = parseMovementRow(sheet.sheet, rowNumber, row);
      if ("message" in parsed) rowErrors.push(parsed);
      else transactions.push(parsed);
    });
  }
  return { transactions, targets, rowErrors };
}
