import type { DayMover, DayMovers, PositionRow } from "./types";

/** Quantos ativos cada lado mostra. */
export const DAY_MOVERS_LIMIT = 3;

function toMover(row: PositionRow & { changePercent: number }): DayMover {
  return {
    ticker: row.ticker,
    name: row.name,
    logoUrl: row.logoUrl,
    assetClass: row.assetClass,
    price: row.price,
    changePercent: row.changePercent,
    // O que a posição ganhou ou perdeu no pregão: o valor de hoje menos o de ontem.
    amount: row.currentValue - row.currentValue / (1 + row.changePercent),
  };
}

/**
 * As maiores altas e baixas do pregão entre as posições abertas, pela variação em %: só sobe quem
 * subiu e só cai quem caiu (um ativo parado não entra em nenhum lado). Empate vai pelo ticker.
 */
export function dayMovers(rows: readonly PositionRow[], limit = DAY_MOVERS_LIMIT): DayMovers {
  const priced = rows.filter(
    (row): row is PositionRow & { changePercent: number } =>
      row.changePercent !== null && row.price !== null && row.currentValue > 0,
  );
  const gainers = priced
    .filter((row) => row.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent || a.ticker.localeCompare(b.ticker))
    .slice(0, limit)
    .map(toMover);
  const losers = priced
    .filter((row) => row.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent || a.ticker.localeCompare(b.ticker))
    .slice(0, limit)
    .map(toMover);
  return { gainers, losers };
}
