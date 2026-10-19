import { findOversells } from "../../domain/positions";
import type { LedgerEntry, PriceSource, TransactionSource } from "../../domain/types";
import type { ParsedPlanilha } from "../parse-planilha";
import type {
  AssetTypeInfo,
  B3ImportAnswers,
  B3ImportPlan,
  DividendCheck,
  DividendCheckItem,
  ExistingTransaction,
  MovementRow,
  MovimentacaoData,
  NegociacaoData,
  PendingItem,
  PlannedDividend,
  PlannedDividends,
  PlannedTransaction,
  TickerPlan,
} from "./types";

// Regras: docs/superpowers/specs/2026-10-18-importacao-b3-design.md (§4 a §7).

const DAY = 86_400_000;
const EPSILON = 1e-6;
const FII_CODE = /^[A-Z0-9]{4}11$/;
const RECEIPT_CODE = /^[A-Z0-9]{4}1[3-9]$/;
const RIGHTS_OR_RECEIPT_CODE = /^[A-Z0-9]{4}1[2-9]$/;
/** Códigos da família de um FII (cota, direito ou recibo): só eles podem ser levados ao FII. */
const FII_FAMILY_CODE = /^[A-Z0-9]{4}1[1-9]$/;
const TICKER_CODE = /^[A-Z0-9]{4}\d{1,2}$/;
const EXERCISE_WINDOW = 10 * DAY;
const SHEET_PRICE_WINDOW = 60 * DAY;
const FRACTION_WINDOW = 60 * DAY;
const REDEMPTION_WINDOW = 30 * DAY;

export class B3ImportError extends Error {}

export type PlanInput = {
  negociacao: NegociacaoData;
  movimentacao: MovimentacaoData;
  planilha: ParsedPlanilha | null;
  existing: readonly ExistingTransaction[];
  /** Tipo de cada código no catálogo; ausente ou null = fora do catálogo. */
  assetTypes: ReadonlyMap<string, AssetTypeInfo | null>;
  answers?: B3ImportAnswers;
};

const family = (code: string) => code.slice(0, 4);
const fiiOf = (code: string) => `${family(code)}11`;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const qtyKey = (quantity: number) => String(Math.round(quantity * 1e6) / 1e6);
const sameQty = (a: number, b: number) => Math.abs(a - b) < EPSILON;
const subId = (ticker: string, date: Date, quantity: number) =>
  `sub:${ticker}:${isoDay(date)}:${qtyKey(quantity)}`;
const convId = (ticker: string, date: Date, quantity: number) =>
  `conv:${ticker}:${isoDay(date)}:${qtyKey(quantity)}`;
const prevId = (ticker: string) => `prev:${ticker}`;

// --- Classificação (§4) ---------------------------------------------------------------------

type Classification =
  { managed: true; outOfCatalog: boolean; untyped: boolean } | { managed: false; reason: string };

function classify(code: string, types: ReadonlyMap<string, AssetTypeInfo | null>): Classification {
  const info = types.get(code) ?? null;
  if (info) {
    const subType = info.subType?.toLowerCase() ?? null;
    if (info.type === "fund" && (subType === "fii" || subType === "fi-agro")) {
      return { managed: true, outOfCatalog: false, untyped: false };
    }
    if (info.type === "fund" && !subType && FII_CODE.test(code)) {
      return { managed: true, outOfCatalog: false, untyped: true };
    }
    if (info.type === "stock") return { managed: false, reason: "Ações e units" };
    if (info.type === "bdr") return { managed: false, reason: "BDRs" };
    if (subType === "etf") return { managed: false, reason: "ETFs" };
    if (subType === "fi-infra") return { managed: false, reason: "FI-Infra" };
    return { managed: false, reason: "Outros fundos (FIP, FIDC...)" };
  }
  if (FII_CODE.test(code)) return { managed: true, outOfCatalog: true, untyped: false };
  if (RIGHTS_OR_RECEIPT_CODE.test(code)) {
    return { managed: false, reason: "Direitos e recibos (o recibo entra como subscrição do FII)" };
  }
  if (TICKER_CODE.test(code)) return { managed: false, reason: "Outros ativos fora do catálogo" };
  return { managed: false, reason: "Renda fixa e Tesouro" };
}

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
        if (other === ticker || current.quantity <= EPSILON) return false;
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
  const { negociacao, movimentacao, planilha, existing, assetTypes } = input;
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
  const classifications = new Map<string, Classification>();
  const classificationOf = (code: string) => {
    let result = classifications.get(code);
    if (!result) {
      result = classify(code, assetTypes);
      classifications.set(code, result);
      if (!result.managed) {
        (
          ignored.get(result.reason) ?? ignored.set(result.reason, new Set()).get(result.reason)!
        ).add(code);
      }
    }
    return result;
  };
  const managed = (code: string) => classificationOf(code).managed;
  const outOfCatalog = (code: string) => {
    const result = classificationOf(code);
    return result.managed && result.outOfCatalog;
  };

  if (negociacao.otherMarkets > 0) {
    warnings.push(
      `${negociacao.otherMarkets} negócios fora do mercado à vista (opções, termo...) foram ignorados.`,
    );
  }
  for (const error of [...negociacao.rowErrors, ...movimentacao.rowErrors]) {
    warnings.push(`${error.sheet}, linha ${error.row}: ${error.message}`);
  }

  const answeredPrice = (id: string): { price: number; source: PriceSource } | null => {
    const price = answers.prices?.[id];
    if (price === undefined || !(price > 0)) return null;
    return { price, source: answers.estimated?.includes(id) ? "ESTIMADO" : "USUARIO" };
  };

  // Respostas de uploads anteriores ficam nos próprios lançamentos B3 do período (§7).
  const previousSubscription = new Map<string, { price: number; source: PriceSource }>();
  const previousConversion = new Map<string, string>();
  for (const entry of existing) {
    if (entry.source !== "B3" || !inPeriod(entry.date)) continue;
    if (
      entry.kind === "SUBSCRICAO" &&
      (entry.priceSource === "USUARIO" || entry.priceSource === "ESTIMADO")
    ) {
      previousSubscription.set(subId(entry.ticker, entry.date, entry.quantity), {
        price: entry.unitPrice,
        source: entry.priceSource,
      });
    }
    if (entry.kind === "INCORPORACAO" && entry.type === "BUY" && entry.relatedTicker) {
      previousConversion.set(`${entry.ticker}:${isoDay(entry.date)}`, entry.relatedTicker);
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
        if (!row.credit || !FII_CODE.test(row.code) || !managed(row.code) || quantity <= 0) break;
        b3Tickers.add(row.code);
        updates.push({ ticker: row.code, quantity, date: row.date, row: row.row });
        break;
      }
      case "Desdobro": {
        if (!row.credit || !FII_CODE.test(row.code) || !managed(row.code) || quantity <= 0) break;
        b3Tickers.add(row.code);
        touch(row.code, row.date);
        planned.push({
          ticker: row.code,
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
        if (!FII_FAMILY_CODE.test(row.code)) break;
        const ticker = fiiOf(row.code);
        if (managed(ticker))
          unsupported.set(ticker, `Grupamento em ${isoDay(row.date)} não é suportado.`);
        break;
      }
      case "Leilão de Fração": {
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
  // Tudo o que aparece nos extratos e não é FII entra na lista de ignorados da prévia.
  for (const row of movimentacao.rows) classificationOf(row.code);
  for (const trade of negociacao.trades) classificationOf(trade.ticker);

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
    check: dividendCheck(movimentacao.rows, final.timeline, managed),
    dividends: extractDividends(movimentacao, accepted, [...tickers].sort()),
    totals,
  };
}

// --- Proventos (spec proventos, §3.1) ------------------------------------------------------

const DIVIDEND_ROW_KINDS: Record<string, PlannedDividend["kind"]> = {
  Rendimento: "RENDIMENTO",
  Reembolso: "REEMBOLSO",
};

function extractDividends(
  movimentacao: MovimentacaoData,
  accepted: (ticker: string) => boolean,
  tickers: readonly string[],
): PlannedDividends {
  const inserts: PlannedDividend[] = [];
  for (const row of movimentacao.rows) {
    const kind = DIVIDEND_ROW_KINDS[row.kind];
    if (!row.credit || !kind || !FII_FAMILY_CODE.test(row.code)) continue;
    if (row.value === null || row.value <= 0) continue;
    const ticker = fiiOf(row.code);
    if (!accepted(ticker)) continue;
    inserts.push({
      ticker,
      paidAt: row.date,
      kind,
      amount: row.value,
      quantity: row.quantity,
      perShare: row.unitPrice,
    });
  }
  return {
    period: { start: movimentacao.firstDate!, end: movimentacao.lastDate! },
    tickers: tickers.filter(accepted),
    inserts,
  };
}

// --- Conferência pelos rendimentos (§6.7) -----------------------------------------------------

function dividendCheck(
  rows: readonly MovementRow[],
  timeline: ReadonlyMap<string, [number, number][]>,
  managed: (code: string) => boolean,
): DividendCheck {
  const quantityAt = (ticker: string, when: number) => {
    let quantity = 0;
    for (const [date, value] of timeline.get(ticker) ?? []) {
      if (date > when) break;
      quantity = value;
    }
    return quantity;
  };

  // Oficial: créditos de Rendimento + Reembolso por FII da família e mês de pagamento.
  const official = new Map<
    string,
    { ticker: string; month: string; quantity: number; last: number }
  >();
  for (const row of rows) {
    if (!row.credit || (row.kind !== "Rendimento" && row.kind !== "Reembolso")) continue;
    if (!FII_FAMILY_CODE.test(row.code)) continue;
    const ticker = fiiOf(row.code);
    if (!managed(ticker)) continue;
    const month = isoDay(row.date).slice(0, 7);
    const key = `${ticker}|${month}`;
    const item = official.get(key) ?? { ticker, month, quantity: 0, last: 0 };
    item.quantity += row.quantity ?? 0;
    item.last = Math.max(item.last, row.date.getTime());
    official.set(key, item);
  }

  // Aluguel: do "Empréstimo" que abre o contrato (sem valor) até o que fecha (com a taxa).
  // Enquanto as cotas estão emprestadas, o rendimento vem como "Reembolso", sem quantidade.
  const lending: { ticker: string; from: number; to: number }[] = [];
  const loans = rows.filter(
    (row) => row.credit && row.kind === "Empréstimo" && FII_CODE.test(row.code),
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
  const receipts = rows.filter(
    (row) => row.credit && row.kind === "Recibo de Subscrição" && RECEIPT_CODE.test(row.code),
  );

  let matched = 0;
  const explained: DividendCheckItem[] = [];
  const unexplained: DividendCheckItem[] = [];
  for (const item of official.values()) {
    let ok = false;
    for (let when = item.last - 45 * DAY; when <= item.last - DAY && !ok; when += DAY) {
      const rebuilt = quantityAt(item.ticker, when);
      ok = sameQty(rebuilt, item.quantity) || sameQty(Math.floor(rebuilt + EPSILON), item.quantity);
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
      ? "cotas emprestadas (aluguel)"
      : proRata
        ? "recibo de subscrição pró-rata"
        : null;
    (reason ? explained : unexplained).push({
      ticker: item.ticker,
      month: item.month,
      official: item.quantity,
      rebuilt,
      reason,
    });
  }
  const byKey = (a: DividendCheckItem, b: DividendCheckItem) =>
    a.ticker.localeCompare(b.ticker) || a.month.localeCompare(b.month);
  return {
    months: official.size,
    matched,
    explained: explained.sort(byKey),
    unexplained: unexplained.sort(byKey),
  };
}
