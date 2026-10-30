import type { DividendKind } from "../../domain/types";
import { normalizeHeader } from "./cells";
import { DAY, EPSILON, FII_CODE, RECEIPT_CODE, fiiOf, isoDay, sameQty } from "./codes";
import type { LendingLeg } from "./lending";
import type {
  DividendCheck,
  DividendCheckItem,
  EventosData,
  MovementRow,
  PlannedDividend,
  PlannedDividends,
  PlannedForecast,
  PlannedUpcoming,
} from "./types";

// Proventos, "a receber" e a conferência pelos proventos (spec proventos, §3.1; spec
// atualizacao-b3, §3; spec ações etapa 1, §5.6 e §6). Puro: o plano decide os ativos aceitos.

/**
 * O ativo de uma linha de provento ou de "a receber", se o app o acompanha: a própria ação ou o
 * FII da família (`…12` a `…19` vão ao `…11`). Null para o resto.
 */
export type DividendTickerOf = (code: string) => string | null;

// Map, e não objeto: um tipo de linha como "constructor" não pode achar nada no prototype.
const DIVIDEND_ROW_KINDS = new Map<string, DividendKind>([
  ["Rendimento", "RENDIMENTO"],
  ["Reembolso", "REEMBOLSO"],
  ["Dividendo", "DIVIDENDO"],
  ["Juros Sobre Capital Próprio", "JCP"],
  // A taxa do aluguel vem no "Empréstimo" com valor; o que abre o contrato não tem valor.
  ["Empréstimo", "ALUGUEL"],
]);

/** Os créditos de provento e de aluguel da Movimentação, com o valor que a B3 mostra. */
export function extractDividends(
  rows: readonly MovementRow[],
  period: PlannedDividends["period"],
  tickerOf: DividendTickerOf,
  accepts: (ticker: string) => boolean,
  acceptedTickers: readonly string[],
): PlannedDividends {
  const inserts: PlannedDividend[] = [];
  for (const row of rows) {
    const kind = DIVIDEND_ROW_KINDS.get(row.kind);
    if (!row.credit || !kind) continue;
    if (row.value === null || row.value <= 0) continue;
    const ticker = tickerOf(row.code);
    if (!ticker || !accepts(ticker)) continue;
    inserts.push({
      ticker,
      paidAt: row.date,
      kind,
      amount: row.value,
      quantity: row.quantity,
      perShare: row.unitPrice,
    });
  }
  // Escopo da troca: os ativos aceitos do plano e os que só aparecem pelos próprios proventos.
  const tickers = new Set([...acceptedTickers, ...inserts.map((item) => item.ticker)]);
  return { period, tickers: [...tickers].sort(), inserts };
}

// Map, e não objeto, pelo mesmo motivo de DIVIDEND_ROW_KINDS. Chaves sem acento e minúsculas.
const FORECAST_EVENT_KINDS = new Map<string, DividendKind>([
  ["rendimento", "RENDIMENTO"],
  ["reembolso - rendimento", "REEMBOLSO"],
  ["dividendo", "DIVIDENDO"],
  ["juros sobre capital proprio", "JCP"],
  ["reembolso - dividendo", "REEMBOLSO"],
  ["reembolso - juros sobre capital proprio", "REEMBOLSO"],
]);

/** A foto do "a receber" (extrato de Eventos): o valor líquido e a previsão da B3. */
export function extractUpcoming(
  eventos: EventosData,
  asOf: Date,
  tickerOf: DividendTickerOf,
  addIgnored: (reason: string, code: string) => void,
): PlannedUpcoming {
  const items: PlannedForecast[] = [];
  for (const row of eventos.rows) {
    // O que o app não acompanha já entrou nos ignorados pela classificação.
    const ticker = tickerOf(row.code);
    if (!ticker) continue;
    const kind = FORECAST_EVENT_KINDS.get(normalizeHeader(row.eventType));
    if (!kind || row.value === null || row.value <= 0) {
      addIgnored("Eventos que não são provento", row.code);
      continue;
    }
    items.push({
      ticker,
      kind,
      payDate: row.payDate,
      quantity: row.quantity,
      perShare: row.unitPrice,
      amount: row.value,
    });
  }
  return { asOf, items };
}

/** A ação paga muito depois da data com: o JCP do ITSA4 de out/2023 era da posição de dez/2022. */
const STOCK_LOOKBACK_DAYS = 365;
const FII_LOOKBACK_DAYS = 45;
const STOCK_CHECK_KINDS = new Set(["Dividendo", "Juros Sobre Capital Próprio", "Rendimento"]);

export type DividendCheckInput = {
  rows: readonly MovementRow[];
  /** Posição de cada ativo depois de cada lançamento: [data, quantidade]. */
  timeline: ReadonlyMap<string, [number, number][]>;
  tickerOf: DividendTickerOf;
  isStock: (ticker: string) => boolean;
  /** Contratos de aluguel (lending.ts): também explicam diferenças. */
  legs: readonly LendingLeg[];
};

type OfficialMonth = {
  ticker: string;
  month: string;
  /** Data do último pagamento do mês. */
  last: number;
  /** Quantidades que, se forem a posição de algum dia da janela, fazem o mês bater. */
  candidates: number[];
  /** A que a prévia mostra: nos FIIs, a soma do mês; nas ações, a maior linha. */
  shown: number;
};

/**
 * Conferência pelos proventos (spec importacao-b3, §6.7; spec ações etapa 1, §5.6).
 * - FIIs: créditos de Rendimento e Reembolso por FII e mês, somados (duas corretoras pagam
 *   duas linhas). A posição igual é buscada até 45 dias antes do pagamento.
 * - Ações: cada linha de Dividendo, JCP e Rendimento com quantidade, e a soma das linhas do
 *   mesmo provento (tipo, dia e valor por ação). O mês bate se uma delas é a posição de algum
 *   dia até 365 dias antes. O mês não é somado inteiro: JCP e dividendo do mesmo dia são, cada
 *   um, sobre a posição inteira.
 */
export function dividendCheck({
  rows,
  timeline,
  tickerOf,
  isStock,
  legs,
}: DividendCheckInput): DividendCheck {
  const quantityAt = (ticker: string, when: number) => {
    let quantity = 0;
    for (const [date, value] of timeline.get(ticker) ?? []) {
      if (date > when) break;
      quantity = value;
    }
    return quantity;
  };

  const fiiMonths = new Map<
    string,
    { ticker: string; month: string; quantity: number; last: number }
  >();
  type StockMonth = {
    ticker: string;
    month: string;
    last: number;
    rows: number[];
    events: Map<string, number>;
  };
  const stockMonths = new Map<string, StockMonth>();
  for (const row of rows) {
    if (!row.credit) continue;
    const ticker = tickerOf(row.code);
    if (!ticker) continue;
    const month = isoDay(row.date).slice(0, 7);
    const key = `${ticker}|${month}`;
    if (isStock(ticker)) {
      if (!STOCK_CHECK_KINDS.has(row.kind) || !row.quantity || row.quantity <= 0) continue;
      const item: StockMonth = stockMonths.get(key) ?? {
        ticker,
        month,
        last: 0,
        rows: [],
        events: new Map(),
      };
      item.rows.push(row.quantity);
      const event = `${row.kind}|${row.date.getTime()}|${row.unitPrice ?? ""}`;
      item.events.set(event, (item.events.get(event) ?? 0) + row.quantity);
      item.last = Math.max(item.last, row.date.getTime());
      stockMonths.set(key, item);
      continue;
    }
    if (row.kind !== "Rendimento" && row.kind !== "Reembolso") continue;
    const item = fiiMonths.get(key) ?? { ticker, month, quantity: 0, last: 0 };
    item.quantity += row.quantity ?? 0;
    item.last = Math.max(item.last, row.date.getTime());
    fiiMonths.set(key, item);
  }
  const official: OfficialMonth[] = [
    ...[...fiiMonths.values()].map((item) => ({
      ticker: item.ticker,
      month: item.month,
      last: item.last,
      candidates: [item.quantity],
      shown: item.quantity,
    })),
    ...[...stockMonths.values()].map((item) => ({
      ticker: item.ticker,
      month: item.month,
      last: item.last,
      candidates: [...new Set([...item.rows, ...item.events.values()])],
      shown: Math.max(...item.rows),
    })),
  ];

  // Aluguel: do "Empréstimo" que abre o contrato (sem valor) até o que fecha (com a taxa).
  // Enquanto as cotas estão emprestadas, o rendimento vem como "Reembolso", sem quantidade.
  const lending: { ticker: string; from: number; to: number }[] = [];
  const loans = rows.filter(
    (row) =>
      row.credit && row.kind === "Empréstimo" && (FII_CODE.test(row.code) || isStock(row.code)),
  );
  for (const open of loans) {
    if (open.value !== null || !open.quantity) continue;
    const close = loans.find(
      (row) =>
        row.code === open.code &&
        row.value !== null &&
        sameQty(row.quantity ?? 0, open.quantity ?? 0) &&
        row.date >= open.date,
    );
    lending.push({
      ticker: open.code,
      from: open.date.getTime(),
      to: (close?.date.getTime() ?? open.date.getTime()) + 45 * DAY,
    });
  }
  const settlements = rows.filter((row) => row.kind === "Transferência - Liquidação");
  for (const out of settlements) {
    if (out.credit || out.unitPrice !== null || !FII_CODE.test(out.code)) continue;
    const back = settlements.find(
      (row) =>
        row.credit &&
        row.code === out.code &&
        sameQty(row.quantity ?? 0, out.quantity ?? 0) &&
        row.date >= out.date,
    );
    lending.push({
      ticker: out.code,
      from: out.date.getTime(),
      to: (back?.date.getTime() ?? out.date.getTime()) + 45 * DAY,
    });
  }
  // Os contratos pareados pelo lending.ts (ações e FIIs) entram junto.
  for (const leg of legs) {
    lending.push({
      ticker: leg.ticker,
      from: leg.out.getTime(),
      to: (leg.back ?? leg.out).getTime() + 45 * DAY,
    });
  }
  const receipts = rows.filter(
    (row) => row.credit && row.kind === "Recibo de Subscrição" && RECEIPT_CODE.test(row.code),
  );

  let matched = 0;
  const explained: DividendCheckItem[] = [];
  const unexplained: DividendCheckItem[] = [];
  for (const item of official) {
    const lookback = (isStock(item.ticker) ? STOCK_LOOKBACK_DAYS : FII_LOOKBACK_DAYS) * DAY;
    let ok = false;
    for (let when = item.last - lookback; when <= item.last - DAY && !ok; when += DAY) {
      const rebuilt = quantityAt(item.ticker, when);
      ok = item.candidates.some(
        (quantity) =>
          sameQty(rebuilt, quantity) || sameQty(Math.floor(rebuilt + EPSILON), quantity),
      );
    }
    if (ok) {
      matched++;
      continue;
    }
    const rebuilt = quantityAt(item.ticker, item.last - 15 * DAY);
    const lent = lending.some(
      (window) =>
        window.ticker === item.ticker && item.last >= window.from && item.last <= window.to,
    );
    const proRata = receipts.some(
      (receipt) =>
        fiiOf(receipt.code) === item.ticker &&
        item.last >= receipt.date.getTime() &&
        item.last - receipt.date.getTime() <= 60 * DAY,
    );
    const reason = lent
      ? isStock(item.ticker)
        ? "ações alugadas (aluguel)"
        : "cotas emprestadas (aluguel)"
      : proRata
        ? "recibo de subscrição pró-rata"
        : null;
    (reason ? explained : unexplained).push({
      ticker: item.ticker,
      month: item.month,
      official: item.shown,
      rebuilt,
      reason,
    });
  }
  const byKey = (a: DividendCheckItem, b: DividendCheckItem) =>
    a.ticker.localeCompare(b.ticker) || a.month.localeCompare(b.month);
  return {
    months: official.length,
    matched,
    explained: explained.sort(byKey),
    unexplained: unexplained.sort(byKey),
  };
}
