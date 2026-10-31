import type { AportePriority } from "./suno-cascade";

// Smart Buy de ações (documento do dono "Smart Buy Ações (Dividendos)"; spec smart-buy-acoes, §3):
// só compra abaixo do teto, abaixo da meta e sem viés Aguardar; a maior margem de segurança
// (teto ÷ preço − 1) é atendida primeiro, cada ação até a sua meta. As mesmas regras dão a coluna
// Prioridade das ações (stockPriorities; spec tabelas-unificadas, §3.2).

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
  | "SEM_SALDO";

/** Os motivos que não dependem do saldo: valem também para a coluna Prioridade. */
type StaticReason = Exclude<StockExclusionReason, "SEM_SALDO">;

export type StockBuyOrder = {
  ticker: string;
  rank: number | null;
  quantity: number;
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
const round2 = (value: number) => Math.round(value * 100) / 100;

const valueOf = (asset: StockBuyAsset) => (asset.price !== null ? asset.quantity * asset.price : 0);

type Candidate = {
  asset: StockBuyAsset & { price: number; ceiling: number };
  target: number;
  deficit: number;
  margin: number;
};

/**
 * As regras de elegibilidade, numa função só: quem fica de fora e por quê, e a fila de quem pede ao
 * menos uma ação, da maior para a menor margem de segurança (empate: rank, ticker).
 */
function classify(amount: number, assets: readonly StockBuyAsset[]) {
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
    const target = base * asset.weight;
    const deficit = target - valueOf(asset);
    if (deficit <= EPSILON) {
      out("NA_META");
      continue;
    }
    if (deficit < asset.price - EPSILON) {
      out("PEDIDO_PEQUENO");
      continue;
    }
    candidates.push({
      asset: { ...asset, price: asset.price, ceiling: asset.ceiling },
      target,
      deficit,
      margin: asset.ceiling / asset.price - 1,
    });
  }

  candidates.sort(
    (a, b) =>
      b.margin - a.margin ||
      (a.asset.rank ?? Infinity) - (b.asset.rank ?? Infinity) ||
      a.asset.ticker.localeCompare(b.asset.ticker),
  );
  return { budget, base, excluded, candidates };
}

export function stockSmartBuy(amount: number, assets: readonly StockBuyAsset[]): StockBuyResult {
  const { budget, base, excluded: ineligible, candidates } = classify(amount, assets);
  const excluded: StockBuyResult["excluded"] = [...ineligible];
  let cash = budget;
  const orders: StockBuyOrder[] = [];
  const strategyBefore = base - budget;
  for (const { asset, target, deficit, margin } of candidates) {
    const shares = Math.floor(Math.min(deficit, cash) / asset.price + EPSILON);
    if (shares <= 0) {
      excluded.push({ ticker: asset.ticker, rank: asset.rank, reason: "SEM_SALDO" });
      continue;
    }
    const total = round2(shares * asset.price);
    cash = round2(cash - total);
    const before = valueOf(asset);
    orders.push({
      ticker: asset.ticker,
      rank: asset.rank,
      quantity: shares,
      price: asset.price,
      total,
      marginOfSafety: margin,
      deficitBefore: round2(deficit),
      targetValue: round2(target),
      targetWeight: asset.weight,
      weightBefore: strategyBefore > 0 ? before / strategyBefore : 0,
      // Base com o aporte inteiro: a fração da carteira de ações depois de investida a parte toda.
      weightAfter: base > 0 ? (before + total) / base : 0,
    });
  }

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
 * menos uma ação forma a fila, pela margem de segurança; os outros mostram o motivo.
 */
export function stockPriorities(assets: readonly StockBuyAsset[]): Map<string, AportePriority> {
  const { excluded, candidates } = classify(0, assets);
  const priorities = new Map<string, AportePriority>();
  candidates.forEach((candidate, index) =>
    priorities.set(candidate.asset.ticker, { kind: "fila", position: index + 1 }),
  );
  for (const item of excluded) priorities.set(item.ticker, { kind: "fora", reason: item.reason });
  return priorities;
}
