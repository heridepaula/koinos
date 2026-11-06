import {
  DIVIDEND_KINDS,
  sortLedger,
  type DividendEntry,
  type DividendKind,
  type LedgerEntry,
  type PlannedUpcoming,
} from "@/features/transactions";
import {
  addMonths,
  currentMonthKey,
  monthKeyOfTradeDate,
  parseTradeDate,
  todayTradeDate,
} from "@/shared/lib/time";
import type {
  AdjustedResult,
  KindAmount,
  DividendMonthGroup,
  DividendPace,
  DividendMonthSummary,
  DividendTickerGroup,
  DividendYearGroup,
  UndisclosedDividend,
  UpcomingDividend,
} from "./types";

// Regras: docs/superpowers/specs/2026-10-18-proventos-design.md (§4) e, para a foto da B3,
// docs/superpowers/specs/2026-10-23-atualizacao-b3-design.md (§6).

const DAY = 86_400_000;
const EPSILON = 1e-9;
/** FIIs costumam pagar de 5 a 15 dias depois da data com. Vale quando o fundo não tem histórico. */
const PAY_WINDOW_DAYS = 15;
/** Quantos pagamentos casados o fundo precisa ter para valer o intervalo dele, e o maior intervalo aceito. */
const MIN_LAG_SAMPLES = 2;
const MAX_LAG_DAYS = 45;
/** O JCP anunciado é bruto; o crédito da B3 vem com os 15% de IR retidos. */
const JCP_NET = 0.85;
/** Folga entre a data anunciada e a do crédito da B3 ao dar um anúncio por pago. */
const PAID_TOLERANCE_DAYS = 5;

/** Provento anunciado com data de pagamento (Fundamentus), valor bruto por cota. */
export type ScheduledDividend = {
  comDate: Date;
  payDate: Date;
  perShare: number;
  kind: DividendKind;
};

/** `?tipo=` da URL (rendimento, jcp…). Ausente ou desconhecido: todos os tipos. */
export function parseKindParam(
  value: string | readonly string[] | null | undefined,
): DividendKind | null {
  const raw = (typeof value === "string" ? value : value?.[0])?.toUpperCase();
  return DIVIDEND_KINDS.find((kind) => kind === raw) ?? null;
}

/** Soma por tipo, na ordem de DIVIDEND_KINDS, só os tipos com valor. */
export function sumByKind(items: readonly { kind: DividendKind; amount: number }[]): KindAmount[] {
  const sums = new Map<DividendKind, number>();
  for (const item of items) sums.set(item.kind, (sums.get(item.kind) ?? 0) + item.amount);
  return DIVIDEND_KINDS.filter((kind) => Math.abs(sums.get(kind) ?? 0) >= 0.005).map((kind) => ({
    kind,
    amount: sums.get(kind)!,
  }));
}

/** Cotas de `ticker` no fim do dia anterior a `exDate`. */
export function quantityBefore(
  entries: readonly LedgerEntry[],
  ticker: string,
  exDate: Date,
): number {
  let quantity = 0;
  for (const entry of sortLedger(entries.filter((item) => item.ticker === ticker))) {
    if (entry.date.getTime() >= exDate.getTime()) break;
    quantity += entry.type === "BUY" ? entry.quantity : -entry.quantity;
    if (quantity < EPSILON) quantity = 0;
  }
  return quantity;
}

/**
 * O intervalo habitual, em dias, entre a data ex e o pagamento de cada FII: a mediana dos
 * rendimentos que a B3 já creditou, cada um casado com o anúncio de data ex mais próxima antes do
 * crédito (até 45 dias; um anúncio casa uma vez só). Só entra o fundo com ao menos 2 pagamentos
 * casados; os demais seguem os 15 dias de `PAY_WINDOW_DAYS`. Os anúncios guardados dão uns 13 meses.
 */
export function payLagDays(
  received: readonly DividendEntry[],
  announcements: ReadonlyMap<string, readonly { exDate: Date }[]>,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const [ticker, list] of announcements) {
    const unused = list.map((announcement) => announcement.exDate.getTime()).sort((a, b) => a - b);
    const credits = received
      .filter((item) => item.ticker === ticker && item.kind === "RENDIMENTO")
      .map((item) => item.paidAt.getTime())
      .sort((a, b) => a - b);
    const lags: number[] = [];
    for (const paidAt of credits) {
      let match = -1;
      for (let i = 0; i < unused.length && unused[i] <= paidAt; i++) match = i;
      if (match < 0) continue;
      const lag = Math.round((paidAt - unused[match]) / DAY);
      unused.splice(match, 1);
      if (lag <= MAX_LAG_DAYS) lags.push(lag);
    }
    if (lags.length < MIN_LAG_SAMPLES) continue;
    lags.sort((a, b) => a - b);
    const middle = lags.length >> 1;
    const median = lags.length % 2 ? lags[middle] : (lags[middle - 1] + lags[middle]) / 2;
    result.set(ticker, Math.max(1, Math.round(median)));
  }
  return result;
}

/**
 * Proventos a receber. Com a foto da B3 (extrato de Eventos), valem os itens dela, com a data
 * oficial; o Fundamentus e o Yahoo só completam com o que foi anunciado depois do envio.
 *
 * Do Fundamentus (`schedules`, FIIs e ações, com a data de pagamento anunciada): pagamento a
 * partir do 1º dia do mês atual, data com depois do `asOf` da foto e fora dela (mesmo ativo, tipo e
 * data), cotas no fim da data com e sem crédito da B3 do mesmo ativo e tipo até 5 dias da data
 * anunciada. O JCP entra líquido (85%). O ativo com `schedules` não usa o Yahoo.
 *
 * Do Yahoo: data ex no mês atual ou no anterior, até hoje, sem provento da B3 do mesmo FII pago
 * na data ex ou depois. O pagamento é a data ex mais o intervalo habitual do fundo (`payLag`; 15
 * dias sem histórico). Do mês anterior, só o que tinha pagamento previsto para este mês: o que
 * vencia no mês passado é daquele mês, não deste.
 */
export function upcomingDividends(input: {
  now: Date;
  transactions: readonly LedgerEntry[];
  received: readonly DividendEntry[];
  announcements: ReadonlyMap<string, readonly { exDate: Date; perShare: number }[]>;
  forecast?: PlannedUpcoming | null;
  /** Intervalo habitual data ex → pagamento por FII (`payLagDays`); sem ele, 15 dias. */
  payLag?: ReadonlyMap<string, number>;
  /** Anúncios com data de pagamento por ativo (Fundamentus). Quem está aqui não usa o Yahoo. */
  schedules?: ReadonlyMap<string, readonly ScheduledDividend[]>;
}): UpcomingDividend[] {
  const month = currentMonthKey(input.now);
  const firstMonth = addMonths(month, -1);
  // Datas ex são datas de negócio (meia-noite UTC): compara com o dia de hoje em São Paulo.
  const today = todayTradeDate(input.now);
  const monthStart = parseTradeDate(`${month}-01`);
  const { forecast } = input;
  const result: UpcomingDividend[] = (forecast?.items ?? []).map((item) => ({
    ticker: item.ticker,
    kind: item.kind,
    exDate: null,
    quantity: item.quantity,
    perShare: item.perShare,
    amount: item.amount,
    payBy: item.payDate,
    comDate: null,
    source: "B3",
  }));
  result.push(...scheduledUpcoming(input, monthStart));
  for (const [ticker, list] of input.announcements) {
    if (input.schedules?.has(ticker)) continue;
    for (const announcement of list) {
      // A B3 tem prioridade: o que foi anunciado até o envio já está (ou não) na foto dela.
      if (forecast && announcement.exDate.getTime() <= forecast.asOf.getTime()) continue;
      const exMonth = monthKeyOfTradeDate(announcement.exDate);
      if (exMonth < firstMonth || exMonth > month) continue;
      if (announcement.exDate.getTime() > today.getTime()) continue;
      const lag = input.payLag?.get(ticker) ?? PAY_WINDOW_DAYS;
      const payBy = new Date(announcement.exDate.getTime() + lag * DAY);
      if (exMonth < month && payBy.getTime() < monthStart.getTime()) continue;
      const paid = input.received.some(
        (item) => item.ticker === ticker && item.paidAt.getTime() >= announcement.exDate.getTime(),
      );
      if (paid) continue;
      const quantity = quantityBefore(input.transactions, ticker, announcement.exDate);
      if (quantity <= 0) continue;
      result.push({
        ticker,
        kind: "RENDIMENTO",
        exDate: announcement.exDate,
        quantity,
        perShare: announcement.perShare,
        amount: quantity * announcement.perShare,
        payBy,
        comDate: null,
        source: "YAHOO",
      });
    }
  }
  // Pela data de pagamento (sem data por último) e, no empate, pela data ex.
  const time = (date: Date | null) => date?.getTime() ?? Number.POSITIVE_INFINITY;
  return result.sort(
    (a, b) =>
      time(a.payBy) - time(b.payBy) ||
      (a.exDate?.getTime() ?? 0) - (b.exDate?.getTime() ?? 0) ||
      a.ticker.localeCompare(b.ticker),
  );
}

/** O mesmo tipo, ou o Reembolso (o que volta do aluguel no lugar do provento). */
const sameKind = (credit: DividendKind, announced: DividendKind) =>
  credit === announced || credit === "REEMBOLSO";

/** Os itens do Fundamentus do "a receber" (regras em `upcomingDividends`). */
function scheduledUpcoming(
  input: {
    transactions: readonly LedgerEntry[];
    received: readonly DividendEntry[];
    forecast?: PlannedUpcoming | null;
    schedules?: ReadonlyMap<string, readonly ScheduledDividend[]>;
  },
  monthStart: Date,
): UpcomingDividend[] {
  const { forecast } = input;
  const tolerance = PAID_TOLERANCE_DAYS * DAY;
  const result: UpcomingDividend[] = [];
  for (const [ticker, list] of input.schedules ?? []) {
    // Cada crédito da B3 confirma um anúncio só: dois JCP no mesmo dia são dois créditos.
    const credits = input.received.filter((item) => item.ticker === ticker);
    const used = new Set<DividendEntry>();
    const ordered = [...list].sort((a, b) => a.payDate.getTime() - b.payDate.getTime());
    for (const item of ordered) {
      if (item.payDate.getTime() < monthStart.getTime()) continue;
      if (forecast && item.comDate.getTime() <= forecast.asOf.getTime()) continue;
      const inSnapshot = forecast?.items.some(
        (planned) =>
          planned.ticker === ticker &&
          planned.kind === item.kind &&
          planned.payDate?.getTime() === item.payDate.getTime(),
      );
      if (inSnapshot) continue;
      const credit = credits.find(
        (entry) =>
          !used.has(entry) &&
          sameKind(entry.kind, item.kind) &&
          Math.abs(entry.paidAt.getTime() - item.payDate.getTime()) <= tolerance,
      );
      if (credit) {
        used.add(credit);
        continue;
      }
      // Quem tinha no fim da data com recebe: as cotas antes do dia seguinte.
      const quantity = quantityBefore(
        input.transactions,
        ticker,
        new Date(item.comDate.getTime() + DAY),
      );
      if (quantity <= 0) continue;
      const perShare = item.kind === "JCP" ? item.perShare * JCP_NET : item.perShare;
      result.push({
        ticker,
        kind: item.kind,
        exDate: null,
        comDate: item.comDate,
        quantity,
        perShare,
        amount: quantity * perShare,
        payBy: item.payDate,
        source: "FUNDAMENTUS",
      });
    }
  }
  return result;
}

/**
 * FIIs da carteira que pagam todo mês e ainda não divulgaram o provento deste mês: receberam nos
 * dois meses anteriores, têm cotas hoje e, neste mês, não receberam, não estão no "a receber" e
 * não têm anúncio do Yahoo com data ex no mês. `lastAmount` é o que pagaram no mês passado.
 */
export function undisclosedDividends(input: {
  now: Date;
  transactions: readonly LedgerEntry[];
  received: readonly DividendEntry[];
  announcements: ReadonlyMap<string, readonly { exDate: Date }[]>;
  upcoming: readonly UpcomingDividend[];
}): UndisclosedDividend[] {
  const month = currentMonthKey(input.now);
  const previous = addMonths(month, -1);
  const beforePrevious = addMonths(month, -2);
  const tomorrow = new Date(todayTradeDate(input.now).getTime() + DAY);
  const paidIn = new Map<string, Map<string, number>>();
  for (const item of input.received) {
    const byMonth = paidIn.get(item.ticker) ?? new Map<string, number>();
    const key = monthKeyOfTradeDate(item.paidAt);
    byMonth.set(key, (byMonth.get(key) ?? 0) + item.amount);
    paidIn.set(item.ticker, byMonth);
  }
  const listed = new Set(input.upcoming.map((item) => item.ticker));
  const result: UndisclosedDividend[] = [];
  for (const [ticker, byMonth] of paidIn) {
    const lastAmount = byMonth.get(previous);
    if (lastAmount === undefined || !byMonth.has(beforePrevious) || byMonth.has(month)) continue;
    if (listed.has(ticker)) continue;
    const announced = (input.announcements.get(ticker) ?? []).some(
      (announcement) => monthKeyOfTradeDate(announcement.exDate) === month,
    );
    if (announced) continue;
    if (quantityBefore(input.transactions, ticker, tomorrow) <= 0) continue;
    result.push({ ticker, lastAmount });
  }
  return result.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

/**
 * Ritmo dos proventos: a média por mês dos últimos 12 meses fechados (sem o mês atual, que ainda
 * está pela metade), o total do ano atual até hoje e o do ano passado.
 */
export function dividendPace(now: Date, received: readonly DividendEntry[]): DividendPace {
  const month = currentMonthKey(now);
  const firstMonth = addMonths(month, -12);
  const year = month.slice(0, 4);
  const lastYear = String(Number(year) - 1);
  let last12 = 0;
  let thisYear = 0;
  let previousYear = 0;
  for (const item of received) {
    const key = monthKeyOfTradeDate(item.paidAt);
    if (key >= firstMonth && key < month) last12 += item.amount;
    if (key.startsWith(year)) thisYear += item.amount;
    else if (key.startsWith(lastYear)) previousYear += item.amount;
  }
  return {
    year: Number(year),
    last12m: last12,
    monthlyAverage12m: last12 / 12,
    thisYear,
    lastYear: previousYear,
  };
}

export function monthSummary(
  now: Date,
  received: readonly DividendEntry[],
  upcoming: readonly UpcomingDividend[],
): DividendMonthSummary {
  const month = currentMonthKey(now);
  const monthReceived = received.filter((item) => monthKeyOfTradeDate(item.paidAt) === month);
  const receivedTotal = monthReceived.reduce((sum, item) => sum + item.amount, 0);
  // Da B3, só o que tem pagamento previsto neste mês; os estimados seguem a regra da lista.
  const monthUpcoming = upcoming.filter(
    (item) =>
      item.source === "YAHOO" || (item.payBy !== null && monthKeyOfTradeDate(item.payBy) === month),
  );
  const upcomingTotal = monthUpcoming.reduce((sum, item) => sum + item.amount, 0);
  return {
    month,
    received: receivedTotal,
    upcoming: upcomingTotal,
    total: receivedTotal + upcomingTotal,
    byKind: sumByKind([...monthReceived, ...monthUpcoming]),
  };
}

/** Por mês, do mais recente para o mais antigo, com o detalhe por FII (maior primeiro). */
export function groupByMonth(received: readonly DividendEntry[]): DividendMonthGroup[] {
  const months = new Map<string, Map<string, number>>();
  for (const item of received) {
    const key = monthKeyOfTradeDate(item.paidAt);
    const tickers = months.get(key) ?? new Map<string, number>();
    tickers.set(item.ticker, (tickers.get(item.ticker) ?? 0) + item.amount);
    months.set(key, tickers);
  }
  return [...months]
    .map(([month, tickers]) => ({
      month,
      total: [...tickers.values()].reduce((sum, value) => sum + value, 0),
      byTicker: [...tickers]
        .map(([ticker, amount]) => ({ ticker, amount }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** Por ano: total e média mensal sobre os meses com algum provento. */
export function groupByYear(received: readonly DividendEntry[]): DividendYearGroup[] {
  const years = new Map<string, { total: number; months: Set<string>; items: DividendEntry[] }>();
  for (const item of received) {
    const month = monthKeyOfTradeDate(item.paidAt);
    const year = month.slice(0, 4);
    const group = years.get(year) ?? { total: 0, months: new Set<string>(), items: [] };
    group.total += item.amount;
    group.items.push(item);
    group.months.add(month);
    years.set(year, group);
  }
  return [...years]
    .map(([year, group]) => ({
      year,
      total: group.total,
      months: group.months.size,
      monthlyAverage: group.total / group.months.size,
      byKind: sumByKind(group.items),
    }))
    .sort((a, b) => b.year.localeCompare(a.year));
}

/** Por papel: total acumulado, número de pagamentos e o último (maior total primeiro). */
export function groupByTicker(received: readonly DividendEntry[]): DividendTickerGroup[] {
  const tickers = new Map<string, DividendTickerGroup>();
  for (const item of received) {
    const group = tickers.get(item.ticker) ?? {
      ticker: item.ticker,
      total: 0,
      payments: 0,
      lastPaidAt: item.paidAt,
    };
    group.total += item.amount;
    group.payments += 1;
    if (item.paidAt > group.lastPaidAt) group.lastPaidAt = item.paidAt;
    tickers.set(item.ticker, group);
  }
  return [...tickers.values()].sort((a, b) => b.total - a.total);
}

/** Total recebido por FII, desde sempre. */
export function dividendsByTicker(received: readonly DividendEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of received)
    totals.set(item.ticker, (totals.get(item.ticker) ?? 0) + item.amount);
  return totals;
}

/** Com proventos = cotação + proventos; total = cotação + proventos + vendas. */
export function adjustedResult(
  unrealized: number,
  dividends: number,
  realized: number,
): AdjustedResult {
  return { withDividends: unrealized + dividends, total: unrealized + dividends + realized };
}
