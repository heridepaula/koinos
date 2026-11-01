import { ENGINE_VERSIONS, type EngineOptions } from "./engine-options";
import type { AportePriority } from "./suno-cascade";

// Smart Buy de ações (documento do dono "Smart Buy Ações (Dividendos)"; spec smart-buy-acoes, §3):
// só compra abaixo do teto, abaixo da meta e sem viés Aguardar; a maior margem de segurança
// (teto ÷ preço − 1) é atendida primeiro, cada ação até a sua meta. As mesmas regras dão a coluna
// Prioridade das ações (stockPriorities; spec tabelas-unificadas, §3.2).
// Na 3.1 (spec koinos-3-1, §4.3 e §4.4), as ordens saem em lotes (`stockLot`) e, com `stockLeftover`,
// a sobra vai um lote por vez para a ação mais abaixo da meta, entre as que cabem no caixa.

export type StockBias = "COMPRAR" | "AGUARDAR";

export type StockBuyAsset = {
  ticker: string;
  rank: number | null;
  ceiling: number | null;
  price: number | null;
  quantity: number;
  /** Peso-alvo na estratégia de ações, como fração: a meta é base × peso. */
  weight: number;
  bias: StockBias | null;
};

export type StockExclusionReason =
  | "SEM_COTACAO"
  | "SEM_TETO"
  | "ACIMA_DO_TETO"
  | "AGUARDAR"
  | "NA_META"
  | "PEDIDO_PEQUENO"
  | "MENOS_DE_UM_LOTE"
  | "SEM_SALDO";

/** Os motivos que não dependem do saldo: valem também para a coluna Prioridade. */
type StaticReason = Exclude<StockExclusionReason, "SEM_SALDO">;

export type StockBuyOrder = {
  ticker: string;
  rank: number | null;
  quantity: number;
  /** Ações vindas do passo de sobra (0 sem ele). */
  fromLeftover: number;
  /** O tamanho do lote usado (1 na 3.0, 100 na 3.1). */
  lot: number;
  price: number;
  total: number;
  marginOfSafety: number;
  deficitBefore: number;
  targetValue: number;
  /** Peso-alvo (fração), como recebido. */
  targetWeight: number;
  weightBefore: number;
  weightAfter: number;
};

export type StockBuyResult = {
  amount: number;
  spent: number;
  leftover: number;
  base: number;
  orders: StockBuyOrder[];
  excluded: { ticker: string; rank: number | null; reason: StockExclusionReason }[];
};

const EPSILON = 1e-9;
const MAX_LEFTOVER_ROUNDS = 100_000;
const round2 = (value: number) => Math.round(value * 100) / 100;

const valueOf = (asset: StockBuyAsset) => (asset.price !== null ? asset.quantity * asset.price : 0);

type PricedAsset = StockBuyAsset & { price: number; ceiling: number };

const marginOf = (asset: PricedAsset) => asset.ceiling / asset.price - 1;

/** Empate: o melhor rank (sem rank por último), depois o ticker. */
const byRank = (a: StockBuyAsset, b: StockBuyAsset) =>
  (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.ticker.localeCompare(b.ticker);

/** A fila do passo 1: da maior para a menor margem de segurança. */
const byMargin = (a: PricedAsset, b: PricedAsset) => marginOf(b) - marginOf(a) || byRank(a, b);

/** Quem pode receber na sobra: com cotação, com teto, até o teto, sem Aguardar e com peso. */
const receivesLeftover = (asset: StockBuyAsset): asset is PricedAsset =>
  asset.price !== null &&
  asset.price > 0 &&
  asset.ceiling !== null &&
  asset.price <= asset.ceiling + EPSILON &&
  asset.bias !== "AGUARDAR" &&
  asset.weight > 0;

type Candidate = { asset: PricedAsset; deficit: number };

/**
 * As regras de elegibilidade, numa função só: quem fica de fora e por quê, e a fila de quem pede ao
 * menos um lote, da maior para a menor margem de segurança (empate: rank, ticker).
 */
function classify(amount: number, assets: readonly StockBuyAsset[], options: EngineOptions) {
  const lot = options.stockLot;
  const budget = Math.max(0, round2(amount));
  const base = assets.reduce((sum, asset) => sum + valueOf(asset), 0) + budget;
  const excluded: { ticker: string; rank: number | null; reason: StaticReason }[] = [];
  const candidates: Candidate[] = [];

  for (const asset of assets) {
    const out = (reason: StaticReason) =>
      excluded.push({ ticker: asset.ticker, rank: asset.rank, reason });
    if (asset.price === null || asset.price <= 0) {
      out("SEM_COTACAO");
      continue;
    }
    if (asset.ceiling === null) {
      out("SEM_TETO");
      continue;
    }
    if (asset.price > asset.ceiling + EPSILON) {
      out("ACIMA_DO_TETO");
      continue;
    }
    if (asset.bias === "AGUARDAR") {
      out("AGUARDAR");
      continue;
    }
    const deficit = base * asset.weight - valueOf(asset);
    if (deficit <= EPSILON) {
      out("NA_META");
      continue;
    }
    if (deficit < lot * asset.price - EPSILON) {
      out(lot > 1 ? "MENOS_DE_UM_LOTE" : "PEDIDO_PEQUENO");
      continue;
    }
    candidates.push({ asset: { ...asset, price: asset.price, ceiling: asset.ceiling }, deficit });
  }

  candidates.sort((a, b) => byMargin(a.asset, b.asset));
  return { budget, base, excluded, candidates };
}

type Purchase = { asset: PricedAsset; shares: number; fromLeftover: number };

export function stockSmartBuy(
  amount: number,
  assets: readonly StockBuyAsset[],
  options: EngineOptions = ENGINE_VERSIONS["3.0"],
): StockBuyResult {
  const lot = options.stockLot;
  const { budget, base, excluded: ineligible, candidates } = classify(amount, assets, options);
  let cash = budget;
  const purchases = new Map<string, Purchase>();
  const held = (asset: PricedAsset) => purchases.get(asset.ticker)?.shares ?? 0;
  // O custo em centavos de mais `shares` ações: o caixa perde a diferença do total da ordem, que é
  // sempre a quantidade × o preço arredondada, mesmo com lotes comprados em voltas diferentes.
  const costOf = (asset: PricedAsset, shares: number) =>
    round2((held(asset) + shares) * asset.price) - round2(held(asset) * asset.price);
  const buy = (asset: PricedAsset, shares: number, leftover: boolean) => {
    cash = round2(cash - costOf(asset, shares));
    const purchase = purchases.get(asset.ticker) ?? { asset, shares: 0, fromLeftover: 0 };
    purchase.shares += shares;
    if (leftover) purchase.fromLeftover += shares;
    purchases.set(asset.ticker, purchase);
  };

  // Passo 1: pela margem de segurança, cada ação compra os lotes inteiros que cabem no déficit e no
  // caixa.
  for (const { asset, deficit } of candidates) {
    const lotCost = lot * asset.price;
    const lots = Math.min(
      Math.floor(deficit / lotCost + EPSILON),
      Math.floor(cash / lotCost + EPSILON),
    );
    if (lots > 0) buy(asset, lots * lot, false);
  }

  // Passo de sobra: um lote por vez para a menor razão (valor + comprado) ÷ meta, entre as que
  // cabem no caixa. Pode passar da meta, como na sobra dos FIIs.
  if (options.stockLeftover) {
    const pool = assets.filter(receivesLeftover);
    const fill = (asset: PricedAsset) =>
      (valueOf(asset) + held(asset) * asset.price) / (base * asset.weight);
    for (let round = 0; round < MAX_LEFTOVER_ROUNDS; round++) {
      const pick = pool.reduce<PricedAsset | null>((best, asset) => {
        if (costOf(asset, lot) > cash + EPSILON) return best;
        return best === null || (fill(asset) - fill(best) || byRank(asset, best)) < 0
          ? asset
          : best;
      }, null);
      if (pick === null) break;
      buy(pick, lot, true);
    }
  }

  const strategyBefore = base - budget;
  const orderOf = ({ asset, shares, fromLeftover }: Purchase): StockBuyOrder => {
    const before = valueOf(asset);
    const target = base * asset.weight;
    const total = round2(shares * asset.price);
    return {
      ticker: asset.ticker,
      rank: asset.rank,
      quantity: shares,
      fromLeftover,
      lot,
      price: asset.price,
      total,
      marginOfSafety: marginOf(asset),
      deficitBefore: round2(target - before),
      targetValue: round2(target),
      targetWeight: asset.weight,
      weightBefore: strategyBefore > 0 ? before / strategyBefore : 0,
      // Base com o aporte inteiro: a fração da carteira de ações depois de investida a parte toda.
      weightAfter: base > 0 ? (before + total) / base : 0,
    };
  };

  // As ordens do passo 1 na ordem da fila; depois, pela margem, as que só receberam na sobra.
  const all = [...purchases.values()];
  const orders = [
    ...all.filter((purchase) => purchase.shares > purchase.fromLeftover),
    ...all
      .filter((purchase) => purchase.shares === purchase.fromLeftover)
      .sort((a, b) => byMargin(a.asset, b.asset)),
  ].map(orderOf);

  // Quem ficou sem nada mantém o motivo do passo 1; o candidato sem lote comprado ficou sem saldo.
  const excluded: StockBuyResult["excluded"] = [
    ...ineligible,
    ...candidates.map(({ asset }) => ({
      ticker: asset.ticker,
      rank: asset.rank,
      reason: "SEM_SALDO" as const,
    })),
  ].filter((item) => !purchases.has(item.ticker));

  return {
    amount: budget,
    spent: round2(budget - cash),
    leftover: cash,
    base: round2(base),
    orders,
    excluded,
  };
}

/**
 * A coluna Prioridade das ações, com aporte zero (o mesmo tipo da cascata de FIIs): quem pede ao
 * menos um lote forma a fila, pela margem de segurança; os outros mostram o motivo.
 */
export function stockPriorities(
  assets: readonly StockBuyAsset[],
  options: EngineOptions = ENGINE_VERSIONS["3.0"],
): Map<string, AportePriority> {
  const { excluded, candidates } = classify(0, assets, options);
  const priorities = new Map<string, AportePriority>();
  candidates.forEach((candidate, index) =>
    priorities.set(candidate.asset.ticker, { kind: "fila", position: index + 1 }),
  );
  for (const item of excluded) priorities.set(item.ticker, { kind: "fora", reason: item.reason });
  return priorities;
}
