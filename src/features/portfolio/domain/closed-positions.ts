import { replayLedger, type LedgerEntry, type PriceSource } from "@/features/transactions";
import type { ClosedPosition, ClosedPositionsTotals } from "./types";

/** Alíquota do IR sobre o ganho de capital na venda de cotas de FII: 20%, sem isenção. */
export const FII_CAPITAL_GAINS_RATE = 0.2;

/** Abaixo de meio centavo o resultado é sobra de ponto flutuante: vale como zero. */
const HALF_CENT = 0.005;

/**
 * O que a conta precisa de cada lançamento: o do livro-razão, mais a origem do preço (para marcar
 * o preço estimado) e o FII do outro lado da incorporação.
 */
export type ClosedLedgerEntry = LedgerEntry & {
  priceSource?: PriceSource | null;
  relatedTicker?: string | null;
};

/**
 * IR estimado sobre o resultado das vendas de um FII: 20% do lucro, sem a isenção que as ações
 * têm. Prejuízo (ou zero) não paga. Arredondado ao centavo.
 */
export function estimateCapitalGainsTax(realizedPnL: number): number {
  if (realizedPnL < HALF_CENT) return 0;
  return Math.round(realizedPnL * FII_CAPITAL_GAINS_RATE * 100) / 100;
}

/**
 * As posições zeradas hoje, da encerrada mais recente para a mais antiga. Cada uma soma as vendas
 * de verdade (negócios e leilões de fração) de todos os ciclos, pelo preço médio vigente em cada
 * venda (`replayLedger`). A perna de saída de uma incorporação não é venda: o custo segue para o
 * FII de destino, sem resultado nem IR. O IR é estimado por posição, sem compensar prejuízos.
 */
export function closedPositions(transactions: readonly ClosedLedgerEntry[]): ClosedPosition[] {
  const { positions, sales } = replayLedger(transactions);
  const entryById = new Map(transactions.map((entry) => [entry.id, entry]));
  const estimated = estimatedTickers(transactions);

  return positions
    .filter((position) => position.quantity === 0)
    .map((position) => {
      const exits = sales.filter((sale) => sale.ticker === position.ticker);
      const sold = exits.filter((sale) => sale.kind !== "INCORPORACAO");
      const costBasis = sold.reduce((sum, sale) => sum + sale.cost, 0);
      const proceeds = sold.reduce((sum, sale) => sum + sale.proceeds, 0);
      // Sem a sobra de ponto flutuante (o −0,00% de um resultado zerado).
      const realizedPnL = Math.abs(proceeds - costBasis) < HALF_CENT ? 0 : proceeds - costBasis;
      // A última saída é a que zerou a posição: compra depois dela deixaria cotas, e a compra do
      // mesmo dia vem antes da venda.
      const last = exits[exits.length - 1];
      return {
        ticker: position.ticker,
        closedAt: last?.date ?? position.lastDate,
        sales: sold.length,
        costBasis,
        proceeds,
        realizedPnL,
        realizedPct: costBasis > 0 ? realizedPnL / costBasis : null,
        estimatedTax: estimateCapitalGainsTax(realizedPnL),
        incorporatedInto:
          last?.kind === "INCORPORACAO"
            ? (entryById.get(last.entryId)?.relatedTicker ?? null)
            : null,
        estimatedPrice: sold.length > 0 && estimated.has(position.ticker),
      };
    })
    .sort(
      (a, b) => b.closedAt.getTime() - a.closedAt.getTime() || a.ticker.localeCompare(b.ticker),
    );
}

/**
 * FIIs com algum preço de compra estimado (nem a B3 nem a planilha o tinham), direto ou herdado:
 * o destino de uma incorporação recebe o custo da origem, e com ele a estimativa. A marca é por
 * FII, não por ciclo, então pode sobrar num ciclo sem estimativa, mas nunca falta.
 */
function estimatedTickers(transactions: readonly ClosedLedgerEntry[]): Set<string> {
  const estimated = new Set(
    transactions
      .filter((entry) => entry.type === "BUY" && entry.priceSource === "ESTIMADO")
      .map((entry) => entry.ticker),
  );
  const incorporations = transactions.filter(
    (entry) => entry.type === "BUY" && entry.kind === "INCORPORACAO" && entry.relatedTicker,
  );
  // Repete até não mudar mais, para as cadeias (A → B → C).
  let grew = true;
  while (grew) {
    grew = false;
    for (const entry of incorporations) {
      if (estimated.has(entry.relatedTicker!) && !estimated.has(entry.ticker)) {
        estimated.add(entry.ticker);
        grew = true;
      }
    }
  }
  return estimated;
}

/** Somas das posições encerradas, para os cards da tela. */
export function summarizeClosedPositions(rows: readonly ClosedPosition[]): ClosedPositionsTotals {
  const sum = (items: readonly ClosedPosition[], pick: (row: ClosedPosition) => number) =>
    items.reduce((total, row) => total + pick(row), 0);
  const withProfit = rows.filter((row) => row.realizedPnL >= HALF_CENT);
  const withLoss = rows.filter((row) => row.realizedPnL <= -HALF_CENT);
  return {
    count: rows.length,
    costBasis: sum(rows, (row) => row.costBasis),
    proceeds: sum(rows, (row) => row.proceeds),
    realizedPnL: sum(rows, (row) => row.realizedPnL),
    estimatedTax: sum(rows, (row) => row.estimatedTax),
    profit: sum(withProfit, (row) => row.realizedPnL),
    loss: sum(withLoss, (row) => row.realizedPnL),
    withProfit: withProfit.length,
    withLoss: withLoss.length,
  };
}
