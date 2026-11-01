import { splitAmount } from "./aporte-split";
import type { EngineOptions } from "./engine-options";
import type { RiskMacro } from "./risk";
import {
  normalGenerator,
  simulateAportes,
  type PricePath,
  type SimulationInput,
  type SimulationParams,
  type SimulationPeriod,
} from "./simulation";
import { isDividendSuspended, type CascadeAsset } from "./suno-cascade";

// Notas das lentes (spec koinos-3-1, §6.1): o laboratório roda as versões do motor sobre a mesma
// carteira e compara estas notas. Frações em 0..1 (0,95 = 95%), valores em R$. Com caminhos de
// preço, cada nota é a média das simulações, salvo onde o tipo diz outra coisa.

export type Scorecard = {
  /** Tiago Reis: gasto ÷ (parte × períodos), por carteira e no total. Null na carteira sem parte do aporte. */
  investedPct: { fii: number | null; stock: number | null; total: number };
  /**
   * Tiago Reis: fração do primeiro aporte (aos preços de hoje) que troca de ativo com ruído de 1% nos
   * preços, ½ Σ |total com ruído − total sem ruído| ÷ aporte, média de 100 cenários.
   */
  stability: number;
  /** Tiago Reis: ordens acima do teto, com Aguardar ou de FII suspenso, somadas em todas as simulações. Precisa dar zero. */
  outsideMethod: number;
  /** Baroni: ½ Σ |peso − meta| dos FIIs depois do último aporte e a média por período. */
  fiiDeviation: { final: number; average: number };
  /** Baroni: FIIs que receberam ao menos uma ordem numa simulação. */
  fiisFunded: number;
  /** Baroni: por macro, a fração do valor da estratégia de FIIs no fim contra a soma das metas. */
  macro: { macro: RiskMacro; weight: number; target: number }[];
  /** Baroni: ordens de FII por período e a menor ordem (R$) de todas as simulações. */
  fiiOrders: { perPeriod: number; smallest: number | null };
  /** Buffett: rank médio ponderado pelo dinheiro, por classe, sobre todas as ordens (sem os de rank nulo). */
  rankWeighted: { fii: number | null; stock: number | null };
  /** Buffett: fração do gasto em FIIs que foi para FII com freio de proventos ou de vacância abaixo de 1. */
  brakedShare: number;
  /** Barsi: caixa parado nas ações por período, em R$ e como fração da parte das ações. */
  stockIdle: { perPeriod: number; pct: number | null };
  /** Barsi: ordens de ação e lotes por período. */
  stockOrders: { perPeriod: number; lotsPerPeriod: number };
};

const EPSILON = 1e-9;
const STABILITY_SEED = 20261031;
const STABILITY_SCENARIOS = 100;
const STABILITY_SIGMA = 0.01;
const MACROS: readonly RiskMacro[] = ["Papel", "Tijolo", "Outros"];

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const mean = (values: readonly number[]) => (values.length > 0 ? sum(values) / values.length : 0);
const ratio = (value: number, base: number) => (base > 0 ? value / base : 0);

/** Valor da posição; sem cotação, pelo preço médio (como na cascata). */
const valueOf = (asset: CascadeAsset) => asset.quantity * (asset.price ?? asset.averagePrice ?? 0);

/** Rank médio ponderado pelo total das ordens; as de rank nulo ficam fora. Null sem ordem com rank. */
export function rankWeightedAverage(
  orders: readonly { rank: number | null; total: number }[],
): number | null {
  let weighted = 0;
  let money = 0;
  for (const { rank, total } of orders) {
    if (rank === null) continue;
    weighted += rank * total;
    money += total;
  }
  return money > 0 ? weighted / money : null;
}

/** ½ Σ |valor ÷ total − meta| sobre a estratégia de FIIs. */
export function fiiTargetDeviation(fiis: readonly CascadeAsset[]): number {
  const total = sum(fiis.map(valueOf));
  return sum(fiis.map((asset) => Math.abs(ratio(valueOf(asset), total) - asset.weight))) / 2;
}

/**
 * Ordens fora do método num período, conferidas contra o ativo com o preço do período: FII com
 * preço no teto ou acima, com Aguardar ou suspenso; ação acima do teto ou com Aguardar.
 */
export function countOutsideMethod(period: SimulationPeriod, options: EngineOptions): number {
  const fiis = new Map(period.fiis.map((asset) => [asset.ticker, asset]));
  const stocks = new Map(period.stocks.map((asset) => [asset.ticker, asset]));
  let count = 0;
  for (const order of period.fii?.orders ?? []) {
    const asset = fiis.get(order.ticker);
    if (
      !asset ||
      asset.ceiling === null ||
      order.price >= asset.ceiling ||
      asset.bias === "AGUARDAR" ||
      isDividendSuspended(asset, options)
    ) {
      count++;
    }
  }
  for (const order of period.stock?.orders ?? []) {
    const asset = stocks.get(order.ticker);
    if (
      !asset ||
      asset.ceiling === null ||
      order.price > asset.ceiling + EPSILON ||
      asset.bias === "AGUARDAR"
    ) {
      count++;
    }
  }
  return count;
}

/** Os totais do primeiro aporte por ticker, FIIs e ações juntos. */
function firstAporteTotals(
  input: SimulationInput,
  params: SimulationParams,
  prices: PricePath | undefined,
): Map<string, number> {
  const [period] = simulateAportes(input, { ...params, periods: 1, prices });
  const totals = new Map<string, number>();
  for (const order of [...(period?.fii?.orders ?? []), ...(period?.stock?.orders ?? [])]) {
    totals.set(order.ticker, (totals.get(order.ticker) ?? 0) + order.total);
  }
  return totals;
}

/** A estabilidade: só o primeiro aporte, aos preços de hoje, contra 100 cenários de ruído. */
function stability(input: SimulationInput, params: SimulationParams): number {
  const part = splitAmount(params.amount, params.fiisPercent);
  const amount = part.fii + part.stock;
  if (!(amount > 0)) return 0;
  const base = firstAporteTotals(input, params, undefined);
  const tickers = [...input.fiis, ...input.stocks].map((asset) => asset.ticker);
  const normal = normalGenerator(STABILITY_SEED);
  const shifts: number[] = [];
  for (let scenario = 0; scenario < STABILITY_SCENARIOS; scenario++) {
    const noise = new Map(tickers.map((ticker) => [ticker, Math.exp(STABILITY_SIGMA * normal())]));
    const noisy = firstAporteTotals(input, params, (_, ticker) => noise.get(ticker) ?? 1);
    let moved = 0;
    for (const ticker of new Set([...base.keys(), ...noisy.keys()])) {
      moved += Math.abs((noisy.get(ticker) ?? 0) - (base.get(ticker) ?? 0));
    }
    shifts.push(moved / 2 / amount);
  }
  return mean(shifts);
}

/** As notas de uma simulação que entram na média. */
type RunMetrics = {
  fiiSpent: number;
  stockSpent: number;
  finalDeviation: number;
  averageDeviation: number;
  funded: number;
  macroWeight: Map<RiskMacro, number>;
  fiiOrders: number;
  brakedShare: number;
  stockLeftover: number;
  stockOrders: number;
  stockLots: number;
};

function runMetrics(input: SimulationInput, run: readonly SimulationPeriod[]): RunMetrics {
  // Sem períodos, a carteira do fim é a de entrada.
  const finalFiis = run.length > 0 ? run[run.length - 1].fiis : input.fiis;
  const finalTotal = sum(finalFiis.map(valueOf));
  const macroWeight = new Map<RiskMacro, number>();
  for (const asset of finalFiis) {
    macroWeight.set(
      asset.macro,
      (macroWeight.get(asset.macro) ?? 0) + ratio(valueOf(asset), finalTotal),
    );
  }

  const fiiOrders = run.flatMap((period) => period.fii?.orders ?? []);
  const stockOrders = run.flatMap((period) => period.stock?.orders ?? []);
  const fiiSpent = sum(run.map((period) => period.fii?.spent ?? 0));
  const braked = sum(
    fiiOrders
      .filter((order) => order.tensors.dividends < 1 || order.tensors.vacancy < 1)
      .map((order) => order.total),
  );
  const deviations = run.map((period) => fiiTargetDeviation(period.fiis));
  const finalDeviation = fiiTargetDeviation(finalFiis);

  return {
    fiiSpent,
    stockSpent: sum(run.map((period) => period.stock?.spent ?? 0)),
    finalDeviation,
    averageDeviation: deviations.length > 0 ? mean(deviations) : finalDeviation,
    funded: new Set(fiiOrders.map((order) => order.ticker)).size,
    macroWeight,
    fiiOrders: fiiOrders.length,
    brakedShare: ratio(braked, fiiSpent),
    stockLeftover: sum(run.map((period) => period.stock?.leftover ?? 0)),
    stockOrders: stockOrders.length,
    stockLots: sum(stockOrders.map((order) => order.quantity / order.lot)),
  };
}

/**
 * As notas de uma versão do motor. Sem `paths` (ou com a lista vazia), uma simulação com `params`
 * (preços parados quando `params.prices` falta); com `paths`, uma simulação por caminho.
 */
export function scorecard(
  input: SimulationInput,
  params: SimulationParams,
  paths?: readonly PricePath[],
): Scorecard {
  const runs =
    paths && paths.length > 0
      ? paths.map((prices) => simulateAportes(input, { ...params, prices }))
      : [simulateAportes(input, params)];
  const part = splitAmount(params.amount, params.fiisPercent);
  const periods = Math.max(0, params.periods);
  const perPeriod = (value: number) => (periods > 0 ? value / periods : 0);
  const metrics = runs.map((run) => runMetrics(input, run));
  const average = (pick: (run: RunMetrics) => number) => mean(metrics.map(pick));

  const allPeriods = runs.flat();
  const fiiOrders = allPeriods.flatMap((period) => period.fii?.orders ?? []);
  const stockOrders = allPeriods.flatMap((period) => period.stock?.orders ?? []);
  const stockIdle = average((run) => perPeriod(run.stockLeftover));

  const macros = MACROS.filter((macro) => input.fiis.some((asset) => asset.macro === macro));

  return {
    investedPct: {
      fii: part.fii > 0 ? average((run) => ratio(run.fiiSpent, part.fii * periods)) : null,
      stock: part.stock > 0 ? average((run) => ratio(run.stockSpent, part.stock * periods)) : null,
      total: average((run) =>
        ratio(run.fiiSpent + run.stockSpent, (part.fii + part.stock) * periods),
      ),
    },
    stability: stability(input, params),
    outsideMethod: sum(allPeriods.map((period) => countOutsideMethod(period, params.options))),
    fiiDeviation: {
      final: average((run) => run.finalDeviation),
      average: average((run) => run.averageDeviation),
    },
    fiisFunded: average((run) => run.funded),
    macro: macros.map((macro) => ({
      macro,
      weight: average((run) => run.macroWeight.get(macro) ?? 0),
      target: sum(input.fiis.filter((asset) => asset.macro === macro).map((asset) => asset.weight)),
    })),
    fiiOrders: {
      perPeriod: average((run) => perPeriod(run.fiiOrders)),
      smallest: fiiOrders.reduce<number | null>(
        (min, order) => (min === null || order.total < min ? order.total : min),
        null,
      ),
    },
    rankWeighted: {
      fii: rankWeightedAverage(fiiOrders),
      stock: rankWeightedAverage(stockOrders),
    },
    brakedShare: average((run) => run.brakedShare),
    stockIdle: { perPeriod: stockIdle, pct: part.stock > 0 ? stockIdle / part.stock : null },
    stockOrders: {
      perPeriod: average((run) => perPeriod(run.stockOrders)),
      lotsPerPeriod: average((run) => perPeriod(run.stockLots)),
    },
  };
}
