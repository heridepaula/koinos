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
