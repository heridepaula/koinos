import { parseTradeDate } from "@/shared/lib/time";

// Página de proventos do Fundamentus (spec 2026-11-06-fundamentus-pagamentos-design.md): uma
// tabela `#resultado` com a data com, o tipo, a data de pagamento e o valor. FIIs e ações têm
// páginas e colunas diferentes.

export type FundamentusPage = "fii" | "acao";

/** Os tipos que entram no "a receber". Amortização e outros ficam de fora. */
export type ScheduleKind = "RENDIMENTO" | "DIVIDENDO" | "JCP";

/** Um provento anunciado, com a data de pagamento informada pela empresa. */
export type PaySchedule = {
  /** Data com: quem tinha a cota (ou ação) no fim desse dia recebe. Data de negócio. */
  comDate: Date;
  payDate: Date;
  /** Valor bruto por cota (ou por ação). */
  perShare: number;
  kind: ScheduleKind;
};

const stripTags = (cell: string) =>
  cell
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

/** "30/10/2026" vira a data de negócio; "-" ou vazio, null. */
export function parseBrDate(text: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const date = parseTradeDate(`${year}-${month}-${day}`);
  return Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(day) ? null : date;
}

/** "1.234,5678" vira 1234.5678; o que não for número, null. */
export function parseBrNumber(text: string): number | null {
  const clean = text.trim().replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(clean)) return null;
  return Number(clean);
}

/** O tipo pelo texto da página, sem acento e sem caixa. */
export function scheduleKindOf(text: string, page: FundamentusPage): ScheduleKind | null {
  const plain = text.normalize("NFD").replace(/\p{M}/gu, "").trim().toUpperCase();
  if (page === "fii") return plain === "RENDIMENTO" ? "RENDIMENTO" : null;
  if (plain.startsWith("DIVIDENDO")) return "DIVIDENDO";
  if (plain.startsWith("JRS CAP") || plain.startsWith("JUROS")) return "JCP";
  return null;
}

/**
 * Os proventos da página. FII: data com | tipo | pagamento | valor. Ação: data com | valor | tipo |
 * pagamento | por quantas ações (o valor é por esse lote, então é dividido por ele). Linhas sem
 * data de pagamento, com valor inválido ou de outro tipo ficam de fora. Sem a tabela (ticker que
 * o site não conhece), null.
 */
export function parseFundamentusDividends(
  html: string,
  page: FundamentusPage,
): PaySchedule[] | null {
  const table = /<table[^>]*id="resultado"[^>]*>([\s\S]*?)<\/table>/i.exec(html);
  if (!table) return null;
  const body = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i.exec(table[1])?.[1] ?? table[1];
  const result: PaySchedule[] = [];
  for (const row of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) =>
      stripTags(cell[1]),
    );
    if (cells.length < (page === "fii" ? 4 : 5)) continue;
    const [comText, kindText, payText, valueText, lotText] =
      page === "fii"
        ? [cells[0], cells[1], cells[2], cells[3], "1"]
        : [cells[0], cells[2], cells[3], cells[1], cells[4]];
    const comDate = parseBrDate(comText);
    const payDate = parseBrDate(payText);
    const kind = scheduleKindOf(kindText, page);
    const value = parseBrNumber(valueText);
    const lot = parseBrNumber(lotText);
    if (!comDate || !payDate || !kind || value === null || value <= 0 || !lot || lot <= 0) continue;
    result.push({ comDate, payDate, perShare: value / lot, kind });
  }
  return result;
}
