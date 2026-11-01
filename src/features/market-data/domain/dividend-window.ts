/** Um provento por cota: data ex (data de negócio, meia-noite UTC) e valor. */
export type DividendEntry = { exDate: Date; amount: number };

export type DividendWindow = {
  /** Soma por cota dos proventos com data ex na janela. Zero se o último está velho. */
  total: number;
  /** Quantos proventos caíram na janela. Zero se o último está velho. */
  payments: number;
  /** O provento de maior data ex, ou null sem proventos. Vem mesmo com o total zerado. */
  last: DividendEntry | null;
};

/** Último provento com mais de um ano: o FII parou de pagar, e a janela não vale. */
const STALE_LAST_MS = 365 * 86_400_000;

/** Índice do mês de calendário em UTC: dois meses seguidos diferem em 1. */
const monthIndex = (date: Date) => date.getUTCFullYear() * 12 + date.getUTCMonth();

/**
 * Soma os proventos dos 12 meses de calendário (UTC) que terminam no mês do último provento.
 * Uma janela de "365 dias a partir de hoje" pegava 11 ou 13 pagamentos de um FII mensal,
 * conforme o dia do mês; pelo mês do último, ele sempre soma 12.
 *
 * As datas já chegam como datas de negócio (meia-noite UTC): quem chama normaliza com
 * `todayTradeDate`. Se o último provento tem mais de 365 dias em relação a `now`, o total e a
 * contagem são zero, mas `last` continua no resultado.
 */
export function dividendWindow(dividends: readonly DividendEntry[], now: Date): DividendWindow {
  const last = dividends.reduce<DividendEntry | null>(
    (best, dividend) => (!best || dividend.exDate > best.exDate ? dividend : best),
    null,
  );
  if (!last) return { total: 0, payments: 0, last: null };
  if (now.getTime() - last.exDate.getTime() > STALE_LAST_MS) {
    return { total: 0, payments: 0, last };
  }
  const end = monthIndex(last.exDate);
  const inWindow = dividends.filter((dividend) => {
    const month = monthIndex(dividend.exDate);
    return month > end - 12 && month <= end;
  });
  return {
    total: inWindow.reduce((sum, dividend) => sum + dividend.amount, 0),
    payments: inWindow.length,
    last,
  };
}

/**
 * O último provento a guardar: o recém-buscado ou, sem ele, o que já estava guardado.
 * Uma busca sem proventos (janela vazia no Yahoo) não apaga o último conhecido.
 */
export function nextLastDividend<T>(fetched: T | null, stored: T | null): T | null {
  return fetched ?? stored;
}
