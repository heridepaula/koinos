import { findOversells } from "../../domain/positions";
import type { LedgerEntry, PriceSource, TransactionSource } from "../../domain/types";
import type { ParsedPlanilha } from "../parse-planilha";
import { classify, type Classification } from "./classify";
import {
  DAY,
  EPSILON,
  FII_CODE,
  FII_FAMILY_CODE,
  RECEIPT_CODE,
  STOCK_RECEIPT_CODE,
  family,
  fiiOf,
  isoDay,
  qtyKey,
  sameQty,
} from "./codes";
import { dividendCheck, extractDividends, extractUpcoming } from "./dividends";
import { lendingLegs } from "./lending";
import type {
  AssetTypeInfo,
  B3ImportAnswers,
  B3ImportPlan,
  EventosData,
  ExistingTransaction,
  ForecastMismatch,
  MovementRow,
  MovimentacaoData,
  NegociacaoData,
  PendingItem,
  PlannedTransaction,
  TickerPlan,
} from "./types";

// Regras: docs/superpowers/specs/2026-10-18-importacao-b3-design.md (§4 a §7) e, para as ações,
// 2026-10-30-acoes-etapa-1-design.md (§5).

const EXERCISE_WINDOW = 10 * DAY;
const SHEET_PRICE_WINDOW = 60 * DAY;
const FRACTION_WINDOW = 60 * DAY;
const REDEMPTION_WINDOW = 30 * DAY;

export class B3ImportError extends Error {}

export type PlanInput = {
  negociacao: NegociacaoData;
  movimentacao: MovimentacaoData;
  /** Extrato de Eventos (o "a receber"); null quando não veio (script de terminal). */
  eventos: EventosData | null;
  /** Dia do envio: a data da foto do "a receber". */
  asOf: Date;
  planilha: ParsedPlanilha | null;
  existing: readonly ExistingTransaction[];
  /** Tipo de cada código no catálogo; ausente ou null = fora do catálogo. */
  assetTypes: ReadonlyMap<string, AssetTypeInfo | null>;
  answers?: B3ImportAnswers;
};

const subId = (ticker: string, date: Date, quantity: number) =>
  `sub:${ticker}:${isoDay(date)}:${qtyKey(quantity)}`;
const convId = (ticker: string, date: Date, quantity: number) =>
  `conv:${ticker}:${isoDay(date)}:${qtyKey(quantity)}`;
const prevId = (ticker: string) => `prev:${ticker}`;
/** Uma pendência por bonificação: a ação e o dia do evento (as ações a mais do aluguel usam a mesma). */
const bonusId = (ticker: string, date: Date) => `bon:${ticker}:${isoDay(date)}`;

// --- Simulação (mesmas regras do replayLedger, com conversões no meio) --------------------

type SimEntry = {
  ticker: string;
  type: "BUY" | "SELL";
  quantity: number;
  unitPrice: number;
  fees: number;
  date: Date;
  /** Lançamento novo (do extrato) ou id de um lançamento atual. */
  planned: PlannedTransaction | null;
  existingId: string | null;
};
type SimEvent =
  | { op: "ENTRY"; date: Date; order: number; seq: number; entry: SimEntry }
  | { op: "UPDATE"; date: Date; order: number; seq: number; ticker: string; quantity: number };

type TickerState = { quantity: number; cost: number; realized: number };

type ConversionDecision = {
  id: string;
  ticker: string;
  date: Date;
  quantity: number;
  answer: string | null;
  suggestion: string | null;
  candidates: string[];
};

type SimContext = {
  receipts: { family: string; quantity: number; date: Date; converted: boolean }[];
  lastActivity: Map<string, number>;
  redemptions: Map<string, number[]>;
  fractions: { family: string; date: Date; quantity: number }[];
  outOfCatalog: (ticker: string) => boolean;
  /** Só FII tem conversão: a "Atualização" de uma ação só confere o saldo. */
  isFii: (ticker: string) => boolean;
  conversionAnswer: (id: string, ticker: string, date: Date) => string | null;
  acquisitionPrice: (
    id: string,
    ticker: string,
    date: Date,
    quantity: number,
  ) => { price: number | null; source: PriceSource | null };
};

type SimResult = {
  states: Map<string, TickerState>;
  timeline: Map<string, [number, number][]>;
  deficits: Map<string, number>;
  emitted: PlannedTransaction[];
  conversions: ConversionDecision[];
  links: [string, string][];
  acquisitions: PendingItem[];
  problems: Map<string, string[]>;
};

function simulate(events: readonly SimEvent[], context: SimContext): SimResult {
  const states = new Map<string, TickerState>();
  const timeline = new Map<string, [number, number][]>();
  const deficits = new Map<string, number>();
  const emitted: PlannedTransaction[] = [];
  const conversions: ConversionDecision[] = [];
  const links: [string, string][] = [];
  const acquisitions: PendingItem[] = [];
  const problems = new Map<string, string[]>();
  const receipts = context.receipts.map((receipt) => ({ ...receipt }));

  const state = (ticker: string) => {
    let current = states.get(ticker);
    if (!current) {
      current = { quantity: 0, cost: 0, realized: 0 };
      states.set(ticker, current);
    }
    return current;
  };
  const mark = (ticker: string, date: Date) =>
    (timeline.get(ticker) ?? timeline.set(ticker, []).get(ticker)!).push([
      date.getTime(),
      state(ticker).quantity,
    ]);
  const problem = (ticker: string, message: string) =>
    problems.set(ticker, [...(problems.get(ticker) ?? []), message]);

  const buy = (ticker: string, quantity: number, cost: number, date: Date) => {
    const current = state(ticker);
    current.quantity += quantity;
    current.cost += cost;
    mark(ticker, date);
  };
  const sell = (ticker: string, quantity: number, proceeds: number, date: Date) => {
    const current = state(ticker);
    let sold = quantity;
    if (quantity > current.quantity + EPSILON) {
      // Falta posição: registra o déficit (vira "posição anterior") e segue com o que existe.
      deficits.set(ticker, (deficits.get(ticker) ?? 0) + (quantity - current.quantity));
      sold = current.quantity;
    }
    if (sold > EPSILON) {
      const average = current.cost / current.quantity;
      current.realized += proceeds * (sold / quantity) - sold * average;
      current.cost -= sold * average;
      current.quantity -= sold;
    }
    if (Math.abs(current.quantity) < EPSILON) {
      current.quantity = 0;
      current.cost = 0;
    }
    mark(ticker, date);
  };

  const sorted = [...events].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.order - b.order || a.seq - b.seq,
  );
  for (const event of sorted) {
    if (event.op === "ENTRY") {
      const { entry } = event;
      if (entry.type === "BUY") {
        buy(
          entry.ticker,
          entry.quantity,
          entry.quantity * entry.unitPrice + entry.fees,
          entry.date,
        );
      } else {
        sell(
          entry.ticker,
          entry.quantity,
          entry.quantity * entry.unitPrice - entry.fees,
          entry.date,
        );
      }
      continue;
    }

    // "Atualização" que credita cotas de um FII (§5.2).
    const { ticker, quantity, date } = event;
    if (!context.isFii(ticker)) {
      // Ação: igual à posição, só atualiza o saldo; diferente não é suportada (spec ações, §5.3).
      if (!sameQty(state(ticker).quantity, quantity)) {
        problem(
          ticker,
          `Atualização de ${qtyKey(quantity)} ações em ${isoDay(date)} com posição ${qtyKey(state(ticker).quantity)} não é suportada.`,
        );
      }
      continue;
    }
    const receipt = receipts.find(
      (item) =>
        !item.converted &&
        item.family === family(ticker) &&
        sameQty(item.quantity, quantity) &&
        item.date.getTime() <= date.getTime(),
    );
    if (receipt) {
      receipt.converted = true; // recibo virou cota: a compra já entrou na data do recibo
      continue;
    }
    if (sameQty(state(ticker).quantity, quantity)) continue; // atualização de saldo

    // Conversão candidata (§5.4).
    const id = convId(ticker, date, quantity);
    const candidates = [...states.entries()]
      .filter(([other, current]) => {
        if (other === ticker || current.quantity <= EPSILON || !context.isFii(other)) return false;
        if ((context.lastActivity.get(other) ?? 0) > date.getTime()) return false;
        const redeemed = (context.redemptions.get(other) ?? []).some(
          (when) => Math.abs(when - date.getTime()) <= REDEMPTION_WINDOW,
        );
        return context.outOfCatalog(other) || redeemed;
      })
      .sort(([, a], [, b]) => Math.abs(a.quantity - quantity) - Math.abs(b.quantity - quantity))
      .map(([other]) => other);
    const suggestion = candidates[0] ?? null;
    const answer = context.conversionAnswer(id, ticker, date);
    conversions.push({ id, ticker, date, quantity, answer, suggestion, candidates });
    const source = answer ?? suggestion;

    if (source && source !== "NONE") {
      const from = state(source);
      if (from.quantity <= EPSILON) {
        problem(ticker, `Conversão de ${source} em ${isoDay(date)} sem posição na origem.`);
        continue;
      }
      const fractions = context.fractions
        .filter(
          (fraction) =>
            fraction.family === family(ticker) &&
            fraction.date.getTime() >= date.getTime() &&
            fraction.date.getTime() - date.getTime() <= FRACTION_WINDOW,
        )
        .reduce((sum, fraction) => sum + fraction.quantity, 0);
      const toQuantity = quantity + fractions;
      const fromQuantity = from.quantity;
      const cost = from.cost;
      emitted.push(
        {
          ticker: source,
          type: "SELL",
          quantity: fromQuantity,
          unitPrice: cost / fromQuantity,
          fees: 0,
          date,
          kind: "INCORPORACAO",
          priceSource: null,
          relatedTicker: ticker,
          notes: `Incorporação → ${ticker}`,
        },
        {
          ticker,
          type: "BUY",
          quantity: toQuantity,
          unitPrice: cost / toQuantity,
          fees: 0,
          date,
          kind: "INCORPORACAO",
          priceSource: null,
          relatedTicker: source,
          notes: `Incorporação ← ${source} (${qtyKey(fromQuantity)} cotas)`,
        },
      );
      links.push([source, ticker]);
      sell(source, fromQuantity, cost, date);
      buy(ticker, toQuantity, cost, date);
      continue;
    }
    if (source === "NONE") {
      // Não é conversão: cotas que entraram sem negócio, com preço a informar.
      const acquisitionId = subId(ticker, date, quantity);
      const { price, source: priceSource } = context.acquisitionPrice(
        acquisitionId,
        ticker,
        date,
        quantity,
      );
      acquisitions.push({
        id: acquisitionId,
        type: "PRECO_SUBSCRICAO",
        ticker,
        date,
        quantity,
        price,
        priceSource,
      });
      emitted.push({
        ticker,
        type: "BUY",
        quantity,
        unitPrice: price ?? 0,
        fees: 0,
        date,
        kind: "SUBSCRICAO",
        priceSource,
        relatedTicker: null,
        notes: "Entrada sem negócio (Atualização da B3)",
      });
      buy(ticker, quantity, quantity * (price ?? 0), date);
    }
    // Sem resposta e sem sugestão: pendência aberta; o FII não entra.
  }

  return { states, timeline, deficits, emitted, conversions, links, acquisitions, problems };
}

// --- Plano ----------------------------------------------------------------------------------

export function planB3Import(input: PlanInput): B3ImportPlan {
  const { negociacao, movimentacao, eventos, planilha, existing, assetTypes } = input;
  const answers = input.answers ?? {};
  if (!negociacao.firstDate || !negociacao.lastDate) {
    throw new B3ImportError("O extrato de Negociação não tem nenhum negócio.");
  }
  if (!movimentacao.firstDate || !movimentacao.lastDate) {
    throw new B3ImportError("O extrato de Movimentação não tem nenhuma linha.");
  }
  const start = new Date(
    Math.max(negociacao.firstDate.getTime(), movimentacao.firstDate.getTime()),
  );
  const end = new Date(Math.min(negociacao.lastDate.getTime(), movimentacao.lastDate.getTime()));
  if (start > end) throw new B3ImportError("Os dois extratos não têm nenhum período em comum.");
  const earliest = Math.min(negociacao.firstDate.getTime(), movimentacao.firstDate.getTime());
  const priorDate = new Date(earliest - DAY);
  const inPeriod = (date: Date) => date >= start && date <= end;

  const warnings: string[] = [];
  const ignored = new Map<string, Set<string>>();
  const addIgnored = (reason: string, code: string) =>
    (ignored.get(reason) ?? ignored.set(reason, new Set()).get(reason)!).add(code);
  const classifications = new Map<string, Classification>();
  const classificationOf = (code: string) => {
    let result = classifications.get(code);
    if (!result) {
      result = classify(code, assetTypes);
      classifications.set(code, result);
      if (!result.managed) addIgnored(result.reason, code);
    }
    return result;
  };
  const managed = (code: string) => classificationOf(code).managed;
  const outOfCatalog = (code: string) => {
    const result = classificationOf(code);
    return result.managed && result.outOfCatalog;
  };
  const classOf = (code: string) => {
    const result = classificationOf(code);
    return result.managed ? result.assetClass : null;
  };
  const isStock = (code: string) => classOf(code) === "ACAO";
  /** O ativo cuja posição a linha mexe: a cota `…11` do FII ou a própria ação. */
  const holdingOf = (code: string): string | null =>
    isStock(code) || (FII_CODE.test(code) && managed(code)) ? code : null;
  // O ativo de uma linha de provento: a própria ação ou o FII da família (…12 a …19 vão ao …11).
  const dividendTickerOf = (code: string): string | null => {
    if (isStock(code)) return code;
    if (!FII_FAMILY_CODE.test(code)) return null;
    const ticker = fiiOf(code);
    return managed(ticker) ? ticker : null;
  };

  if (negociacao.otherMarkets > 0) {
    warnings.push(
      `${negociacao.otherMarkets} negócios fora do mercado à vista (opções, termo...) foram ignorados.`,
    );
  }
  for (const error of [
    ...negociacao.rowErrors,
    ...movimentacao.rowErrors,
    ...(eventos?.rowErrors ?? []),
  ]) {
    warnings.push(`${error.sheet}, linha ${error.row}: ${error.message}`);
  }

  const answeredPrice = (id: string): { price: number; source: PriceSource } | null => {
    const price = answers.prices?.[id];
    if (price === undefined || !(price > 0)) return null;
    return { price, source: answers.estimated?.includes(id) ? "ESTIMADO" : "USUARIO" };
  };
  // O custo atribuído da bonificação pode ser 0: a empresa nem sempre atribui custo (spec ações, §5.4).
  const answeredBonus = (id: string): { price: number; source: PriceSource } | null => {
    const price = answers.prices?.[id];
    if (price === undefined || !(price >= 0)) return null;
    return { price, source: answers.estimated?.includes(id) ? "ESTIMADO" : "USUARIO" };
  };

  // Respostas de uploads anteriores ficam nos próprios lançamentos B3 do período (§7). O preço
  // que veio da planilha num envio anterior também vale: a página não recebe mais a planilha.
  const previousSubscription = new Map<string, { price: number; source: PriceSource }>();
  const previousConversion = new Map<string, string>();
  const previousBonus = new Map<string, { price: number; source: PriceSource }>();
  for (const entry of existing) {
    if (entry.source !== "B3" || !inPeriod(entry.date)) continue;
    if (
      entry.kind === "SUBSCRICAO" &&
      (entry.priceSource === "USUARIO" ||
        entry.priceSource === "ESTIMADO" ||
        entry.priceSource === "PLANILHA")
    ) {
      previousSubscription.set(subId(entry.ticker, entry.date, entry.quantity), {
        price: entry.unitPrice,
        source: entry.priceSource,
      });
    }
    if (entry.kind === "INCORPORACAO" && entry.type === "BUY" && entry.relatedTicker) {
      previousConversion.set(`${entry.ticker}:${isoDay(entry.date)}`, entry.relatedTicker);
    }
    // O lançamento da linha de bonificação tem a data do evento; o das ações que voltaram do
    // aluguel tem a da volta e só repete o mesmo custo.
    if (
      entry.kind === "BONIFICACAO" &&
      (entry.priceSource === "USUARIO" || entry.priceSource === "ESTIMADO")
    ) {
      previousBonus.set(bonusId(entry.ticker, entry.date), {
        price: entry.unitPrice,
        source: entry.priceSource,
      });
    }
  }

  // Compras da planilha, para os preços que a B3 não informa (§5.3).
  const sheetBuys = (planilha?.transactions ?? [])
    .filter((transaction) => transaction.type === "BUY")
    .map((transaction) => ({ ...transaction, used: false }));
  const conversionDestinations = (ticker: string) =>
    Object.entries(answers.conversions ?? {})
      .filter(([, source]) => source === ticker)
      .map(([id]) => id.split(":")[1]!);
  const sheetPrice = (ticker: string, date: Date, quantity: number): number | null => {
    const tickers = new Set([ticker, ...conversionDestinations(ticker)]);
    const match = sheetBuys
      .filter(
        (buy) =>
          !buy.used &&
          tickers.has(buy.ticker) &&
          sameQty(buy.quantity, quantity) &&
          Math.abs(buy.date.getTime() - date.getTime()) <= SHEET_PRICE_WINDOW,
      )
      .sort(
        (a, b) =>
          Math.abs(a.date.getTime() - date.getTime()) - Math.abs(b.date.getTime() - date.getTime()),
      )[0];
    if (!match) return null;
    match.used = true;
    return match.unitPrice;
  };
  // Memorizado por pendência: a simulação roda duas vezes e cada compra da planilha só serve uma vez.
  const acquisitionPrices = new Map<string, { price: number | null; source: PriceSource | null }>();
  const acquisitionPrice = (id: string, ticker: string, date: Date, quantity: number) => {
    const cached = acquisitionPrices.get(id);
    if (cached) return cached;
    const answered = answeredPrice(id);
    const previous = previousSubscription.get(id);
    const fromSheet = answered || previous ? null : sheetPrice(ticker, date, quantity);
    const result: { price: number | null; source: PriceSource | null } = answered
      ? { price: answered.price, source: answered.source }
      : previous
        ? { price: previous.price, source: previous.source }
        : fromSheet !== null
          ? { price: fromSheet, source: "PLANILHA" }
          : { price: null, source: null };
    acquisitionPrices.set(id, result);
    return result;
  };

  // --- Linhas do extrato que viram lançamentos (dentro do período) -------------------------
  const planned: PlannedTransaction[] = [];
  const subscriptionPending: PendingItem[] = [];
  const updates: { ticker: string; quantity: number; date: Date; row: number }[] = [];
  const unsupported = new Map<string, string>();
  const lastActivity = new Map<string, number>();
  const touch = (ticker: string, date: Date) =>
    lastActivity.set(ticker, Math.max(lastActivity.get(ticker) ?? 0, date.getTime()));
  const b3Tickers = new Set<string>();
  // Bonificações e desdobros (spec ações, §5.3 e §5.5): as ações a mais do aluguel seguem o evento.
  const corporateEvents: { ticker: string; date: Date; kind: "BONIFICACAO" | "DESDOBRO" }[] = [];
  const bonusPending = new Map<string, Extract<PendingItem, { type: "CUSTO_BONIFICACAO" }>>();
  const stockReceipts: MovementRow[] = [];
  /** A compra da bonificação: o custo por ação vem da pendência, que soma as quantidades. */
  const addBonus = (
    ticker: string,
    eventDate: Date,
    date: Date,
    quantity: number,
    note: string,
  ) => {
    const id = bonusId(ticker, eventDate);
    const answer = answeredBonus(id) ?? previousBonus.get(id) ?? null;
    const pending = bonusPending.get(id);
    if (pending) pending.quantity += quantity;
    else {
      bonusPending.set(id, {
        id,
        type: "CUSTO_BONIFICACAO",
        ticker,
        date: eventDate,
        quantity,
        price: answer?.price ?? null,
        priceSource: answer?.source ?? null,
      });
    }
    b3Tickers.add(ticker);
    touch(ticker, date);
    planned.push({
      ticker,
      type: "BUY",
      quantity,
      unitPrice: answer?.price ?? 0,
      fees: 0,
      date,
      kind: "BONIFICACAO",
      priceSource: answer?.source ?? null,
      relatedTicker: null,
      notes: note,
    });
  };

  for (const trade of negociacao.trades) {
    if (!inPeriod(trade.date) || !managed(trade.ticker)) continue;
    b3Tickers.add(trade.ticker);
    touch(trade.ticker, trade.date);
    planned.push({
      ticker: trade.ticker,
      type: trade.type,
      quantity: trade.quantity,
      unitPrice: trade.unitPrice,
      fees: 0,
      date: trade.date,
      kind: "NEGOCIO",
      priceSource: "B3",
      relatedTicker: null,
      notes: null,
    });
  }

  const rows = movimentacao.rows.filter((row) => inPeriod(row.date));
  const exercises = rows.filter(
    (row) => !row.credit && /^Direitos de Subscrição - Exercido$/i.test(row.kind),
  );
  const exclusions = rows.filter((row) => /^Recibo de Subscrição - Excluído$/i.test(row.kind));
  const fractions: SimContext["fractions"] = [];
  const redemptions = new Map<string, number[]>();
  const receiptRegistry: SimContext["receipts"] = [];

  // Resgates que acompanham uma incorporação (§5.2): o valor é troco, não venda.
  const conversionCredits = rows.filter(
    (row) => row.credit && row.kind === "Atualização" && FII_CODE.test(row.code),
  );
  const receiptCredits = rows.filter(
    (row) => row.credit && row.kind === "Recibo de Subscrição" && RECEIPT_CODE.test(row.code),
  );
  const hasReceipt = (row: MovementRow) =>
    receiptCredits.some(
      (receipt) =>
        family(receipt.code) === family(row.code) &&
        sameQty(receipt.quantity ?? 0, row.quantity ?? 0) &&
        receipt.date <= row.date,
    );

  for (const row of rows) {
    const quantity = row.quantity ?? 0;
    switch (row.kind) {
      case "Recibo de Subscrição": {
        if (row.credit && STOCK_RECEIPT_CODE.test(row.code) && quantity > 0) {
          stockReceipts.push(row); // subscrição de ação: não suportada (spec ações, §5.3)
          break;
        }
        if (!row.credit || !RECEIPT_CODE.test(row.code) || quantity <= 0) break;
        const ticker = fiiOf(row.code);
        if (!managed(ticker)) break;
        const cancelled = exclusions.some(
          (exclusion) =>
            exclusion.code === row.code &&
            sameQty(exclusion.quantity ?? 0, quantity) &&
            exclusion.date >= row.date,
        );
        if (cancelled) break;
        b3Tickers.add(ticker);
        touch(ticker, row.date);
        receiptRegistry.push({
          family: family(row.code),
          quantity,
          date: row.date,
          converted: false,
        });
        const id = subId(ticker, row.date, quantity);
        const exercise = exercises.find(
          (item) =>
            family(item.code) === family(row.code) &&
            sameQty(item.quantity ?? 0, quantity) &&
            item.unitPrice !== null &&
            item.date <= row.date &&
            row.date.getTime() - item.date.getTime() <= EXERCISE_WINDOW,
        );
        const { price, source } =
          exercise?.unitPrice != null
            ? { price: exercise.unitPrice, source: "B3" as PriceSource }
            : acquisitionPrice(id, ticker, row.date, quantity);
        if (source !== "B3") {
          subscriptionPending.push({
            id,
            type: "PRECO_SUBSCRICAO",
            ticker,
            date: row.date,
            quantity,
            price,
            priceSource: source,
          });
        }
        planned.push({
          ticker,
          type: "BUY",
          quantity,
          unitPrice: price ?? 0,
          fees: 0,
          date: row.date,
          kind: "SUBSCRICAO",
          priceSource: source,
          relatedTicker: null,
          notes: `Subscrição (recibo ${row.code})${source === "ESTIMADO" ? " · preço estimado" : ""}`,
        });
        break;
      }
      case "Atualização": {
        // A da ação só confere o saldo na simulação (spec ações, §5.3).
        const ticker = holdingOf(row.code);
        if (!row.credit || !ticker || quantity <= 0) break;
        b3Tickers.add(ticker);
        updates.push({ ticker, quantity, date: row.date, row: row.row });
        break;
      }
      case "Bonificação em Ativos": {
        const ticker = holdingOf(row.code);
        if (!row.credit || !ticker || quantity <= 0) break;
        corporateEvents.push({ ticker, date: row.date, kind: "BONIFICACAO" });
        addBonus(ticker, row.date, row.date, quantity, "Bonificação");
        break;
      }
      case "Desdobro": {
        const ticker = holdingOf(row.code);
        if (!row.credit || !ticker || quantity <= 0) break;
        b3Tickers.add(ticker);
        touch(ticker, row.date);
        corporateEvents.push({ ticker, date: row.date, kind: "DESDOBRO" });
        planned.push({
          ticker,
          type: "BUY",
          quantity,
          unitPrice: 0,
          fees: 0,
          date: row.date,
          kind: "DESDOBRO",
          priceSource: "B3",
          relatedTicker: null,
          notes: "Desdobro",
        });
        break;
      }
      case "Grupamento": {
        const ticker = isStock(row.code)
          ? row.code
          : FII_FAMILY_CODE.test(row.code)
            ? fiiOf(row.code)
            : null;
        if (ticker && managed(ticker))
          unsupported.set(ticker, `Grupamento em ${isoDay(row.date)} não é suportado.`);
        break;
      }
      case "Leilão de Fração": {
        if (isStock(row.code)) {
          // Ação: a fração veio de bonificação ou desdobro e já está na posição (spec ações, §5.3).
          if (!row.credit || quantity <= 0) break;
          const price = row.unitPrice ?? (row.value !== null ? row.value / quantity : null);
          if (!price) break;
          b3Tickers.add(row.code);
          touch(row.code, row.date);
          planned.push({
            ticker: row.code,
            type: "SELL",
            quantity,
            unitPrice: price,
            fees: 0,
            date: row.date,
            kind: "FRACAO",
            priceSource: "B3",
            relatedTicker: null,
            notes: "Leilão de fração",
          });
          break;
        }
        if (!FII_FAMILY_CODE.test(row.code)) break;
        const ticker = fiiOf(row.code);
        if (!row.credit || !managed(ticker) || quantity <= 0) break;
        const converted = conversionCredits.some(
          (credit) =>
            family(credit.code) === family(row.code) &&
            !hasReceipt(credit) &&
            credit.date <= row.date &&
            row.date.getTime() - credit.date.getTime() <= FRACTION_WINDOW,
        );
        if (!converted) {
          warnings.push(
            `${ticker}: leilão de fração em ${isoDay(row.date)} sem conversão correspondente.`,
          );
          break;
        }
        const price = row.unitPrice ?? (row.value !== null ? row.value / quantity : null);
        if (!price) break;
        b3Tickers.add(ticker);
        touch(ticker, row.date);
        fractions.push({ family: family(row.code), date: row.date, quantity });
        planned.push({
          ticker,
          type: "SELL",
          quantity,
          unitPrice: price,
          fees: 0,
          date: row.date,
          kind: "FRACAO",
          priceSource: "B3",
          relatedTicker: null,
          notes: "Leilão de fração",
        });
        break;
      }
      case "Resgate": {
        if (!FII_CODE.test(row.code) || !managed(row.code) || quantity <= 0) break;
        redemptions.set(row.code, [...(redemptions.get(row.code) ?? []), row.date.getTime()]);
        const withConversion = conversionCredits.some(
          (credit) =>
            credit.code !== row.code &&
            !hasReceipt(credit) &&
            Math.abs(credit.date.getTime() - row.date.getTime()) <= REDEMPTION_WINDOW,
        );
        if (withConversion) {
          if (row.value) {
            warnings.push(
              `${row.code}: resgate de R$ ${row.value.toFixed(2)} em ${isoDay(row.date)} é troco da incorporação e não entra no custo.`,
            );
          }
          break;
        }
        if (!row.value) break;
        b3Tickers.add(row.code);
        touch(row.code, row.date);
        planned.push({
          ticker: row.code,
          type: "SELL",
          quantity,
          unitPrice: row.value / quantity,
          fees: 0,
          date: row.date,
          kind: "NEGOCIO",
          priceSource: "B3",
          relatedTicker: null,
          notes: "Resgate",
        });
        break;
      }
      default:
        break;
    }
  }
  // Tudo o que aparece nos extratos e o app não acompanha entra na lista de ignorados da prévia.
  for (const row of movimentacao.rows) classificationOf(row.code);
  for (const trade of negociacao.trades) classificationOf(trade.ticker);
  for (const row of eventos?.rows ?? []) classificationOf(row.code);

  // Subscrição de ação (recibo …9 ou …10): não suportada; a ação da mesma família fica de fora.
  for (const receipt of stockReceipts) {
    for (const ticker of b3Tickers) {
      if (isStock(ticker) && family(ticker) === family(receipt.code)) {
        unsupported.set(
          ticker,
          `Subscrição (recibo ${receipt.code}) em ${isoDay(receipt.date)} não é suportada.`,
        );
      }
    }
  }

  // Aluguel (spec ações, §5.5): os extratos inteiros, para parear também o aluguel aberto antes do
  // período. Ações que voltaram a mais entram como o evento que houve durante o aluguel.
  const legs = lendingLegs(
    movimentacao.rows.filter((row) => holdingOf(row.code) !== null),
    negociacao.trades.filter((trade) => holdingOf(trade.ticker) !== null),
  );
  for (const leg of legs) {
    const back = leg.back;
    if (!back || leg.backQuantity === null || !inPeriod(back)) continue;
    const extra = leg.backQuantity - leg.outQuantity;
    if (extra <= EPSILON) continue;
    const event = corporateEvents.find(
      (item) => item.ticker === leg.ticker && item.date >= leg.out && item.date <= back,
    );
    if (!event) {
      warnings.push(
        `${leg.ticker}: voltaram ${qtyKey(extra)} a mais do aluguel em ${isoDay(back)}, sem bonificação ou desdobro durante o aluguel. A posição não muda.`,
      );
      continue;
    }
    if (event.kind === "BONIFICACAO") {
      addBonus(leg.ticker, event.date, back, extra, "Bonificação (ações que estavam alugadas)");
      continue;
    }
    b3Tickers.add(leg.ticker);
    touch(leg.ticker, back);
    planned.push({
      ticker: leg.ticker,
      type: "BUY",
      quantity: extra,
      unitPrice: 0,
      fees: 0,
      date: back,
      kind: "DESDOBRO",
      priceSource: "B3",
      relatedTicker: null,
      notes: "Desdobro (ações que estavam alugadas)",
    });
  }

  // --- Lançamentos atuais: fora do período ficam; dentro, dos FIIs gerenciados, saem -------
  const managedExisting = existing.filter((entry) => managed(entry.ticker));
  const replaced = managedExisting.filter((entry) => inPeriod(entry.date));
  const kept = existing.filter((entry) => !managed(entry.ticker) || !inPeriod(entry.date));
  const unconfirmed = new Map<string, number>();
  for (const entry of replaced) {
    if (!b3Tickers.has(entry.ticker)) {
      unconfirmed.set(entry.ticker, (unconfirmed.get(entry.ticker) ?? 0) + 1);
    }
  }

  const buildEvents = (priors: readonly PlannedTransaction[]): SimEvent[] => {
    const events: SimEvent[] = [];
    let seq = 0;
    const push = (entry: SimEntry) =>
      events.push({
        op: "ENTRY",
        date: entry.date,
        order: entry.type === "BUY" ? 0 : 2,
        seq: seq++,
        entry,
      });
    for (const entry of [...kept].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
      if (!managed(entry.ticker)) continue;
      push({ ...entry, planned: null, existingId: entry.id });
    }
    for (const entry of [...priors, ...planned])
      push({ ...entry, planned: entry, existingId: null });
    for (const update of updates) {
      events.push({
        op: "UPDATE",
        date: update.date,
        order: 1,
        seq: seq++,
        ticker: update.ticker,
        quantity: update.quantity,
      });
    }
    return events;
  };
  const context: SimContext = {
    receipts: receiptRegistry,
    lastActivity,
    redemptions,
    fractions,
    outOfCatalog,
    isFii: (ticker) => classOf(ticker) === "FII",
    conversionAnswer: (id, ticker, date) =>
      answers.conversions?.[id] ?? previousConversion.get(`${ticker}:${isoDay(date)}`) ?? null,
    acquisitionPrice,
  };

  // Passo 1: déficits → posição anterior ao extrato (§6.4).
  const first = simulate(buildEvents([]), context);
  const priorPending: PendingItem[] = [];
  const priors: PlannedTransaction[] = [];
  const priorReplaced = new Set<string>();
  for (const [ticker, quantity] of first.deficits) {
    if (quantity <= EPSILON) continue;
    const id = prevId(ticker);
    const answered = answeredPrice(id);
    const sheetBefore = sheetBuys.filter((buy) => buy.ticker === ticker && buy.date < start);
    const sheetQuantity = sheetBefore.reduce((sum, buy) => sum + buy.quantity, 0);
    const sheetAverage =
      sheetQuantity > 0
        ? sheetBefore.reduce((sum, buy) => sum + buy.quantity * buy.unitPrice, 0) / sheetQuantity
        : null;
    const price = answered?.price ?? sheetAverage;
    const priceSource: PriceSource | null =
      answered?.source ?? (sheetAverage !== null ? "PLANILHA" : null);
    priorPending.push({
      id,
      type: "POSICAO_ANTERIOR",
      ticker,
      date: priorDate,
      quantity,
      price,
      priceSource,
    });
    priors.push({
      ticker,
      type: "BUY",
      quantity,
      unitPrice: price ?? 0,
      fees: 0,
      date: priorDate,
      kind: "POSICAO_ANTERIOR",
      priceSource,
      relatedTicker: null,
      notes: `Posição anterior ao extrato da B3${priceSource === "ESTIMADO" ? " · preço estimado" : ""}`,
    });
  }
  // Posição anterior já gravada, com preço novo respondido: troca o lançamento.
  for (const entry of kept) {
    if (entry.kind !== "POSICAO_ANTERIOR" || !managed(entry.ticker)) continue;
    const answered = answeredPrice(prevId(entry.ticker));
    if (!answered || Math.abs(answered.price - entry.unitPrice) < EPSILON) continue;
    priorReplaced.add(entry.id);
    priors.push({
      ticker: entry.ticker,
      type: "BUY",
      quantity: entry.quantity,
      unitPrice: answered.price,
      fees: 0,
      date: entry.date,
      kind: "POSICAO_ANTERIOR",
      priceSource: answered.source,
      relatedTicker: null,
      notes: `Posição anterior ao extrato da B3${answered.source === "ESTIMADO" ? " · preço estimado" : ""}`,
    });
  }
  const effectiveKept = kept.filter((entry) => !priorReplaced.has(entry.id));

  // Passo 2: histórico final, com as conversões calculadas sobre ele.
  const final = simulate(
    buildEvents(priors).filter(
      (event) =>
        event.op !== "ENTRY" ||
        !event.entry.existingId ||
        !priorReplaced.has(event.entry.existingId),
    ),
    context,
  );

  // --- Grupos (incorporação liga dois FIIs) e aceitação (§6.5) -----------------------------
  const tickers = new Set<string>([
    ...b3Tickers,
    ...replaced.map((entry) => entry.ticker),
    ...priors.map((entry) => entry.ticker),
    // Também precisam de status: a origem de uma incorporação (no período só tem o Resgate) e o
    // FII com Grupamento (sem outra linha). Sem ele, escapam da conferência do grupo.
    ...final.links.flat(),
    ...unsupported.keys(),
  ]);
  const parent = new Map<string, string>([...tickers].map((ticker) => [ticker, ticker]));
  const root = (ticker: string): string => {
    const up = parent.get(ticker) ?? ticker;
    if (up === ticker) return ticker;
    const top = root(up);
    parent.set(ticker, top);
    return top;
  };
  for (const [a, b] of final.links) parent.set(root(a), root(b));
  const groups = new Map<string, string[]>();
  for (const ticker of tickers) {
    const key = root(ticker);
    groups.set(key, [...(groups.get(key) ?? []), ticker].sort());
  }

  const conversionPending: PendingItem[] = final.conversions.map((decision) => ({
    id: decision.id,
    type: "CONVERSAO",
    ticker: decision.ticker,
    date: decision.date,
    quantity: decision.quantity,
    source: decision.answer,
    suggestion: decision.suggestion,
    candidates: decision.candidates,
  }));
  const pending = [
    ...subscriptionPending,
    ...bonusPending.values(),
    ...final.acquisitions,
    ...priorPending,
    ...conversionPending,
  ];
  const isOpen = (item: PendingItem) =>
    item.type === "CONVERSAO" ? item.source === null : item.price === null;
  const relatedTickers = (item: PendingItem) =>
    item.type === "CONVERSAO" && item.source && item.source !== "NONE"
      ? [item.ticker, item.source]
      : [item.ticker];
  const exclude = new Set(answers.exclude ?? []);

  const status = new Map<string, { status: TickerPlan["status"]; reasons: string[] }>();
  const newEntries = [...priors, ...planned, ...final.emitted];
  for (const members of groups.values()) {
    const reasons: string[] = [];
    let groupStatus: TickerPlan["status"] = "OK";
    const memberSet = new Set(members);
    if (members.some((ticker) => exclude.has(ticker))) {
      groupStatus = "FORA";
      reasons.push("Você deixou de fora.");
    }
    for (const ticker of members) {
      const why = unsupported.get(ticker);
      if (why) {
        groupStatus = "FORA";
        reasons.push(why);
      }
      for (const message of final.problems.get(ticker) ?? []) {
        groupStatus = "FORA";
        reasons.push(message);
      }
    }
    if (groupStatus === "OK") {
      const open = pending.filter(
        (item) => isOpen(item) && relatedTickers(item).some((t) => memberSet.has(t)),
      );
      if (open.length > 0) {
        groupStatus = "PENDENTE";
        reasons.push(`${open.length} pendência(s) sem resposta.`);
      }
    }
    if (groupStatus === "OK") {
      // Conferência final com a mesma regra do app: nenhuma venda maior que a posição.
      const history: LedgerEntry[] = [
        ...effectiveKept.filter((entry) => memberSet.has(entry.ticker)),
        ...newEntries
          .filter((entry) => memberSet.has(entry.ticker))
          .map((entry, index) => ({ ...entry, id: `novo-${index}`, createdAt: new Date(index) })),
      ];
      const [oversell] = findOversells(history);
      if (oversell) {
        groupStatus = "FORA";
        reasons.push(
          `Venda de ${qtyKey(oversell.sellQuantity)} cotas de ${oversell.ticker} em ${isoDay(oversell.date)} com posição ${qtyKey(oversell.heldQuantity)}.`,
        );
      }
    }
    for (const ticker of members) status.set(ticker, { status: groupStatus, reasons });
  }

  const accepted = (ticker: string) => status.get(ticker)?.status === "OK";
  // Proventos: quem tem status segue o status (só o OK troca os proventos que já tem).
  const acceptsDividends = (ticker: string) => {
    const decision = status.get(ticker);
    if (decision) return decision.status === "OK";
    // Só aparece pelos proventos: não há o que conferir; entra, salvo se ficou de fora.
    return managed(ticker) && !exclude.has(ticker);
  };
  const inserts = newEntries.filter((entry) => accepted(entry.ticker));
  const removed = [
    ...replaced.filter((entry) => accepted(entry.ticker)),
    ...kept.filter((entry) => priorReplaced.has(entry.id) && accepted(entry.ticker)),
  ];
  const removedBySource: Partial<Record<TransactionSource, number>> = {};
  for (const entry of removed)
    removedBySource[entry.source] = (removedBySource[entry.source] ?? 0) + 1;

  // --- Resumo por FII -------------------------------------------------------------------------
  const tickerPlans: TickerPlan[] = [...tickers].sort().map((ticker) => {
    const current = final.states.get(ticker) ?? { quantity: 0, cost: 0, realized: 0 };
    const counts: TickerPlan["counts"] = {};
    for (const entry of newEntries) {
      if (entry.ticker === ticker) counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
    }
    const decision = status.get(ticker) ?? { status: "OK" as const, reasons: [] };
    return {
      ticker,
      // Todo ativo do plano é acompanhado; o "FII" de reserva só satisfaz o tipo.
      assetClass: classOf(ticker) ?? "FII",
      group: groups.get(root(ticker)) ?? [ticker],
      status: decision.status,
      reasons: decision.reasons,
      quantity: current.quantity,
      averagePrice: current.quantity > EPSILON ? current.cost / current.quantity : 0,
      realizedPnL: current.realized,
      counts,
      outOfCatalog: outOfCatalog(ticker),
      unconfirmed: unconfirmed.get(ticker) ?? 0,
    };
  });

  const totals: B3ImportPlan["totals"] = {};
  for (const entry of newEntries) totals[entry.kind] = (totals[entry.kind] ?? 0) + 1;

  // "A receber" com quantidade diferente da posição final: compra ou venda depois da data com,
  // ou um FII que a carteira não tem (spec atualizacao-b3, §5). Só avisa.
  const upcoming = eventos
    ? extractUpcoming(eventos, input.asOf, dividendTickerOf, addIgnored)
    : null;
  const forecastMismatches: ForecastMismatch[] = [];
  for (const item of upcoming?.items ?? []) {
    const held = final.states.get(item.ticker)?.quantity ?? 0;
    const differs =
      item.quantity === null ? held <= EPSILON : Math.abs(item.quantity - held) > EPSILON;
    if (differs) forecastMismatches.push({ ticker: item.ticker, quantity: item.quantity, held });
  }

  return {
    period: { start, end },
    priorDate,
    tickers: tickerPlans,
    pending,
    inserts,
    removeIds: removed.map((entry) => entry.id),
    removedBySource,
    ignored: [...ignored.entries()]
      .map(([reason, codes]) => ({ reason, codes: [...codes].sort() }))
      .sort((a, b) => a.reason.localeCompare(b.reason)),
    warnings,
    check: dividendCheck({
      rows: movimentacao.rows,
      timeline: final.timeline,
      tickerOf: dividendTickerOf,
      isStock,
      legs,
    }),
    dividends: extractDividends(
      movimentacao.rows,
      { start: movimentacao.firstDate, end: movimentacao.lastDate },
      dividendTickerOf,
      acceptsDividends,
      [...tickers].filter(accepted),
    ),
    upcoming,
    forecastMismatches,
    totals,
  };
}
