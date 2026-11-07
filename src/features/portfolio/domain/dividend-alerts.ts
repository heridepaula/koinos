import type { AssetClass } from "@/features/market-data";
import { DIVIDEND_KIND_LABELS, type DividendEntry } from "@/features/transactions";
import { formatBRL, formatTradeDate } from "@/shared/lib/format";
import { todayTradeDate, toIsoDate } from "@/shared/lib/time";
import type { PortfolioAlert, UpcomingDividend } from "./types";

const DAY_MS = 86_400_000;
/** Por quantos dias o pagamento fica no sino depois de cair na conta. */
export const PAYMENT_ALERT_DAYS = 7;

const dayMonth = (date: Date) => formatTradeDate(date).slice(0, 5);
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/**
 * Os alertas de proventos do sino:
 * - um por provento anunciado que ainda vai pagar (o "a receber": B3, Fundamentus ou Yahoo, este
 *   com a data de pagamento estimada), com o valor por cota e a data;
 * - um por dia de pagamento, do dia de hoje até 7 dias atrás: o que caiu na conta, pelos créditos
 *   da B3 e pelas datas oficiais (B3 e Fundamentus) que já chegaram sem o extrato confirmar. A
 *   estimativa do Yahoo não conta como dinheiro na conta.
 * Os pagamentos vêm primeiro, do mais recente; depois os anúncios, do pagamento mais próximo.
 */
export function dividendAlerts(input: {
  now: Date;
  upcoming: readonly UpcomingDividend[];
  received: readonly DividendEntry[];
  /** A classe de cada ativo: a ação paga "por ação", o FII "por cota". */
  classes?: ReadonlyMap<string, AssetClass | null>;
}): PortfolioAlert[] {
  const today = todayTradeDate(input.now).getTime();
  const since = today - (PAYMENT_ALERT_DAYS - 1) * DAY_MS;
  const inWindow = (date: Date) => date.getTime() >= since && date.getTime() <= today;

  // Pagamentos por dia: os créditos da B3 e os anunciados com data oficial já chegada.
  const byDay = new Map<number, { ticker: string; amount: number }[]>();
  const add = (date: Date, ticker: string, amount: number) => {
    const key = date.getTime();
    byDay.set(key, [...(byDay.get(key) ?? []), { ticker, amount }]);
  };
  for (const item of input.received) {
    if (inWindow(item.paidAt)) add(item.paidAt, item.ticker, item.amount);
  }
  for (const item of input.upcoming) {
    if (item.source !== "YAHOO" && item.payBy && inWindow(item.payBy)) {
      add(item.payBy, item.ticker, item.amount);
    }
  }
  const payments: PortfolioAlert[] = [...byDay]
    .sort(([a], [b]) => b - a)
    .map(([time, items]) => {
      const date = new Date(time);
      const total = items.reduce((sum, item) => sum + item.amount, 0);
      const perTicker = new Map<string, number>();
      for (const item of items) {
        perTicker.set(item.ticker, (perTicker.get(item.ticker) ?? 0) + item.amount);
      }
      const tickers = [...perTicker.keys()].sort();
      return {
        id: `pagamento-${toIsoDate(date)}`,
        level: "dividend",
        title:
          time === today ? "Proventos caem na conta hoje" : `Proventos pagos em ${dayMonth(date)}`,
        detail: tickers.join(" · "),
        amount: total,
        fingerprint: tickers.join(","),
      };
    });

  // Um alerta por ativo, tipo e dia: a B3 pode trazer dois anúncios do mesmo dia (a PETR4 tinha
  // dois reembolsos em 21/12). Com dois alertas de mesmo id, excluir um apagava a exclusão do outro.
  const groups = new Map<string, UpcomingDividend[]>();
  for (const item of input.upcoming) {
    if (item.payBy !== null && item.payBy.getTime() <= today) continue;
    const reference = item.payBy ?? item.comDate ?? item.exDate;
    const id = slug(
      `provento-${item.ticker}-${item.kind}-${reference ? toIsoDate(reference) : "sem-data"}`,
    );
    groups.set(id, [...(groups.get(id) ?? []), item]);
  }
  const announced: PortfolioAlert[] = [...groups]
    .map(([id, items]) => ({ id, items, first: items[0] }))
    .sort(
      (a, b) =>
        (a.first.payBy?.getTime() ?? Infinity) - (b.first.payBy?.getTime() ?? Infinity) ||
        a.first.ticker.localeCompare(b.first.ticker),
    )
    .map(({ id, items, first }) => {
      const perShares = items.map((item) => item.perShare);
      // Os anúncios do mesmo dia somam por cota; sem o valor de algum, o título fica sem valor.
      const perShare = perShares.every((value) => value !== null)
        ? perShares.reduce<number>((sum, value) => sum + (value ?? 0), 0)
        : null;
      const kind = DIVIDEND_KIND_LABELS[first.kind];
      // "SNCI11 anunciou pagamento de R$ 0,11 por cota no dia 13/11". A ação paga "por ação".
      const unit = input.classes?.get(first.ticker) === "ACAO" ? "por ação" : "por cota";
      const value = perShare === null ? "" : ` de ${formatBRL(perShare)} ${unit}`;
      const when =
        first.payBy === null ? " (data ainda não divulgada)" : ` no dia ${dayMonth(first.payBy)}`;
      // O Yahoo não informa o pagamento: a data é a data ex mais o intervalo habitual do fundo.
      const estimate =
        first.payBy !== null && items.some((item) => item.source === "YAHOO")
          ? "Data estimada"
          : null;
      const count = items.length > 1 ? `${items.length} anúncios` : null;
      return {
        id,
        level: "dividend",
        title: `${first.ticker} anunciou pagamento${value}${when}`,
        detail: [kind, count, estimate].filter(Boolean).join(" · "),
        amount: items.reduce((sum, item) => sum + item.amount, 0),
        // Um valor ou uma data nova (a B3 confirmando, por exemplo) reabre o alerta.
        fingerprint: `${items
          .map((item) => String(item.perShare ?? item.amount))
          .sort()
          .join("+")}|${first.payBy ? toIsoDate(first.payBy) : ""}`,
      };
    });

  return [...payments, ...announced];
}
