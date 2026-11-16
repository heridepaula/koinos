/**
 * Os tickers de que o relatório precisa: os do livro-razão e os que só aparecem por proventos
 * (há FIIs que o dono vendeu antes do primeiro extrato e só deixaram créditos).
 */
export function reportTickers(
  entries: readonly { ticker: string }[],
  dividends: readonly { ticker: string }[],
): string[] {
  return [...new Set([...entries.map((e) => e.ticker), ...dividends.map((d) => d.ticker)])];
}

/** Anos (UTC, como as datas de negócio) com lançamento ou provento, do mais recente ao mais antigo. */
export function yearsWithActivity(
  entries: readonly { date: Date }[],
  dividends: readonly { paidAt: Date }[],
): number[] {
  const years = new Set([
    ...entries.map((e) => e.date.getUTCFullYear()),
    ...dividends.map((d) => d.paidAt.getUTCFullYear()),
  ]);
  return [...years].sort((a, b) => b - a);
}

/** O primeiro ano com dados possíveis: o livro-razão começa em nov/2019. */
export const FIRST_REPORT_YEAR = 2019;

/**
 * O ano-calendário que a tela abre: o de `?ano=` quando é um inteiro de 2019 ao ano corrente; senão
 * o padrão, o ano anterior até 30/04 (prazo da declaração) e o corrente depois. A data é a de São
 * Paulo (UTC−3), que decide a virada do prazo.
 */
export function resolveReportYear(raw: string | string[] | null | undefined, now: Date): number {
  const local = new Date(now.getTime() - 3 * 3_600_000);
  const current = local.getUTCFullYear();
  const beforeMay = local.getUTCMonth() < 4;
  const fallback = beforeMay ? current - 1 : current;
  if (typeof raw !== "string" || !/^\d{4}$/.test(raw)) return fallback;
  const year = Number(raw);
  return year >= FIRST_REPORT_YEAR && year <= current ? year : fallback;
}
