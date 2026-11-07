/** Cálculos puros da página de detalhes do ativo (spec 2026-11-07-detalhes-do-ativo). */

type PaidDividend = { paidAt: Date; amount: number };

/**
 * Yield on cost: proventos recebidos nos 12 meses de calendário anteriores ao mês de `now`,
 * divididos pelo custo médio da posição (preço médio × cotas). Null sem posição ou sem custo.
 */
export function yieldOnCost12m(
  dividends: readonly PaidDividend[],
  position: { averagePrice: number; quantity: number },
  now: Date,
): number | null {
  const cost = position.averagePrice * position.quantity;
  if (position.quantity <= 0 || cost <= 0) return null;
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1);
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1); // exclusivo
  const received = dividends
    .filter((item) => item.paidAt.getTime() >= start && item.paidAt.getTime() < end)
    .reduce((sum, item) => sum + item.amount, 0);
  return received / cost;
}

/** Variação do dia em R$ por cota e em %, a partir do preço e do `changePercent` da cotação. */
export function dailyChange(
  price: number | null,
  changePercent: number | null,
): { amount: number; percent: number } | null {
  if (price === null || changePercent === null) return null;
  const previous = price / (1 + changePercent / 100);
  return { amount: price - previous, percent: changePercent };
}
