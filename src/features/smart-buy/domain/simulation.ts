import { round2 } from "@/shared/lib/money";
import { splitAmount } from "./aporte-split";
import type { EngineOptions } from "./engine-options";
import { stockSmartBuy, type StockBuyAsset, type StockBuyResult } from "./stock-buy";
import { sunoCascade, type CascadeAsset, type CascadeResult } from "./suno-cascade";

// Simulação de N aportes com os motores reais (spec koinos-3-1, §6.1): cada período divide o aporte
// entre FIIs e ações, roda a cascata e o smart buy de ações com as opções de uma versão e soma as
// quantidades compradas à carteira. Os preços ficam parados ou andam por um caminho sorteado
// (randomPricePaths), com o P/VP dos FIIs andando junto. É o que o laboratório usa para comparar
// versões (scorecard.ts).

/** A entrada da cascata (a estratégia de FIIs) e a das ações. */
export type SimulationInput = { fiis: readonly CascadeAsset[]; stocks: readonly StockBuyAsset[] };

/** Fator acumulado do preço no período (0 = primeiro aporte), sobre o preço inicial. */
export type PricePath = (period: number, ticker: string) => number;

export type SimulationParams = {
  /** O aporte de cada período, em R$. */
  amount: number;
  /** % do aporte que vai para os FIIs (o resto vai para as ações), como na tela de Recomendações. */
  fiisPercent: number;
  periods: number;
  options: EngineOptions;
  /** Sem caminho, os preços ficam parados. */
  prices?: PricePath;
};

/** Um período: os resultados dos motores e os ativos com o preço do período e as quantidades depois das ordens. */
export type SimulationPeriod = {
  fii: CascadeResult | null;
  stock: StockBuyResult | null;
  fiis: CascadeAsset[];
  stocks: StockBuyAsset[];
};

/** O preço do período: o inicial vezes o fator, em centavos. Fator 1 deixa o preço como veio. */
const scaled = (price: number | null, factor: number) =>
  price === null || factor === 1 ? price : round2(price * factor);

/** Soma à carteira as quantidades das ordens (um ticker por ativo). */
function withOrders<T extends { ticker: string; quantity: number }>(
  assets: readonly T[],
  orders: readonly { ticker: string; quantity: number }[],
): T[] {
  const bought = new Map<string, number>();
  for (const order of orders) {
    bought.set(order.ticker, (bought.get(order.ticker) ?? 0) + order.quantity);
  }
  return assets.map((asset) => {
    const shares = bought.get(asset.ticker);
    if (shares === undefined) return asset;
    bought.delete(asset.ticker);
    return { ...asset, quantity: asset.quantity + shares };
  });
}

export function simulateAportes(
  input: SimulationInput,
  params: SimulationParams,
): SimulationPeriod[] {
  const { options, prices } = params;
  const part = splitAmount(params.amount, params.fiisPercent);
  // As quantidades andam de um período para o outro; os preços saem sempre do inicial × o fator.
  let fiiHoldings: readonly CascadeAsset[] = input.fiis;
  let stockHoldings: readonly StockBuyAsset[] = input.stocks;
  const periods: SimulationPeriod[] = [];

  for (let period = 0; period < params.periods; period++) {
    const factor = (ticker: string) => (prices ? prices(period, ticker) : 1);
    const fiis = input.fiis.map((asset, index): CascadeAsset => {
      const move = factor(asset.ticker);
      return {
        ...asset,
        price: scaled(asset.price, move),
        priceToBook: asset.priceToBook === null ? null : asset.priceToBook * move,
        quantity: fiiHoldings[index].quantity,
      };
    });
    const stocks = input.stocks.map((asset, index): StockBuyAsset => ({
      ...asset,
      price: scaled(asset.price, factor(asset.ticker)),
      quantity: stockHoldings[index].quantity,
    }));

    const fii = part.fii > 0 ? sunoCascade(part.fii, fiis, options) : null;
    const stock = part.stock > 0 ? stockSmartBuy(part.stock, stocks, options) : null;
    fiiHoldings = withOrders(fiis, fii?.orders ?? []);
    stockHoldings = withOrders(stocks, stock?.orders ?? []);
    periods.push({ fii, stock, fiis: [...fiiHoldings], stocks: [...stockHoldings] });
  }
  return periods;
}

/** Embaralha a semente (finalizador do MurmurHash3): sementes vizinhas não dão sequências parecidas. */
function mixSeed(seed: number): number {
  let hash = Math.trunc(seed) | 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

/**
 * Normais N(0, 1) determinísticas: LCG (mod 2³²) com a semente embaralhada e Box-Muller, que usa as
 * duas normais de cada par de sorteios.
 */
export function normalGenerator(seed: number): () => number {
  let state = mixSeed(seed);
  const uniform = () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    const radius = Math.sqrt(-2 * Math.log(1 - uniform())); // 1 − u fica em (0, 1]
    const angle = 2 * Math.PI * uniform();
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
}

/**
 * Caminhos de preço log-normais com semente. O período 0 tem fator 1 (os preços de hoje, então o
 * primeiro aporte é a recomendação atual); do período 1 em diante, o fator é
 * exp(Σ_{k=1..p} (comum_k + próprio_{k,ticker})), com comum ~ N(0, σ comum) igual para todos os
 * ativos e próprio ~ N(0, σ próprio) de cada um. Ticker fora da lista: fator 1. Depois do último
 * período sorteado, o fator fica no último.
 */
export function randomPricePaths(
  seed: number,
  tickers: readonly string[],
  periods: number,
  sigma: { common: number; own: number },
): PricePath {
  const normal = normalGenerator(seed);
  const unique = [...new Set(tickers)];
  const indexOf = new Map(unique.map((ticker, index) => [ticker, index]));
  const series = unique.map(() => [1]);
  const logs = unique.map(() => 0);
  for (let period = 1; period < periods; period++) {
    const common = sigma.common * normal();
    for (let index = 0; index < unique.length; index++) {
      logs[index] += common + sigma.own * normal();
      series[index].push(Math.exp(logs[index]));
    }
  }
  return (period, ticker) => {
    const index = indexOf.get(ticker);
    if (index === undefined) return 1;
    const factors = series[index];
    return factors[Math.min(Math.max(0, Math.floor(period)), factors.length - 1)];
  };
}
