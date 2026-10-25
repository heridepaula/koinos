import { round2 } from "@/shared/lib/money";
import { marginMultiplier, priceToBookMultiplier } from "./conviction";

// Motor de aporte pelo método Suno (orientações públicas da Suno no Suno Conecta):
// 1. só comprar abaixo do preço teto;
// 2. seguir o ranking respeitando a % sugerida: levar o 1º até a meta, depois o 2º, e assim por diante;
// 3. se todos estiverem abaixo do teto e na meta, aportar no de menor peso ou mais abaixo do preço médio.
// Na acumulação, a carteira se rebalanceia pelos aportes, sem vender.
// Índice de Convicção (decisão do dono, 24/10/2026): o quanto cada FII pede é o que falta para a meta
// vezes os multiplicadores da margem até o teto e do P/VP (conviction.ts). O descontado pede mais e
// o caro pede menos. Cada FII compra o menor entre o que pede e o que o saldo paga: o limite por FII
// da entrada aos poucos saiu na mesma data, também por decisão do dono.

export type CascadeAsset = {
  ticker: string;
  rank: number | null;
  ceiling: number | null;
  /** Peso-alvo efetivo na estratégia, como fração (os pesos da estratégia somam 1). */
  weight: number;
  price: number | null;
  quantity: number;
  averagePrice: number | null;
  /** P/VP (cotação ÷ valor patrimonial por cota). Null sem dado: o multiplicador fica neutro. */
  priceToBook: number | null;
};

export type ExclusionReason =
  "SEM_COTACAO" | "SEM_RANKING" | "SEM_TETO" | "ACIMA_DO_TETO" | "NA_META" | "SEM_SALDO";

export type CascadeOrder = {
  ticker: string;
  rank: number;
  quantity: number;
  /** Cotas que vieram do passo 2 (sobra). */
  fromLeftover: number;
  price: number;
  total: number;
  weightBefore: number;
  weightAfter: number;
  targetWeight: number;
  /** (teto − preço) / teto */
  marginToCeiling: number;
  priceToBook: number | null;
  /** Multiplicadores do Índice de Convicção usados (1 = neutro). */
  marginMultiplier: number;
  priceToBookMultiplier: number;
  /** Quanto faltava (R$) para a meta antes do aporte (o gap base). */
  gapBefore: number;
  /** Gap base × multiplicadores: o quanto o FII pediu neste aporte. */
  adjustedGap: number;
  /** Cotas desejadas: gap ajustado ÷ preço, arredondado para a cota mais próxima. */
  desired: number;
  /** Quanto falta (R$) para a meta depois desta ordem. */
  gapAfter: number;
};

export type CascadeExclusion = { ticker: string; rank: number | null; reason: ExclusionReason };

export type CascadeResult = {
  amount: number;
  spent: number;
  leftover: number;
  /** Valor atual dos ativos da estratégia (antes do aporte). */
  strategyValue: number;
  orders: CascadeOrder[];
  excluded: CascadeExclusion[];
};

const EPSILON = 1e-9;
const MAX_LEFTOVER_STEPS = 100_000;

type Eligible = CascadeAsset & {
  price: number;
  rank: number;
  ceiling: number;
  value: number;
  target: number;
  marginMultiplier: number;
  priceToBookMultiplier: number;
  adjustedGap: number;
  desired: number;
  bought: number;
  fromLeftover: number;
};

/** A primeira regra de elegibilidade que falhar define o motivo de exclusão. */
function eligibilityFailure(asset: CascadeAsset): ExclusionReason | null {
  if (asset.price === null || !(asset.price > 0)) return "SEM_COTACAO";
  if (asset.rank === null) return "SEM_RANKING";
  if (asset.ceiling === null) return "SEM_TETO";
  if (asset.price >= asset.ceiling) return "ACIMA_DO_TETO";
  return null;
}

/** Sem cotação, o valor da posição usa o preço médio. */
const positionValue = (asset: CascadeAsset) =>
  asset.quantity * (asset.price ?? asset.averagePrice ?? 0);

const byRankThenTicker = (
  a: { rank: number | null; ticker: string },
  b: { rank: number | null; ticker: string },
) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.ticker.localeCompare(b.ticker);

export function sunoCascade(amount: number, assets: readonly CascadeAsset[]): CascadeResult {
  const budget = Math.max(0, round2(amount));
  const strategyValue = assets.reduce((sum, asset) => sum + positionValue(asset), 0);
  const total = strategyValue + budget;

  const excluded: CascadeExclusion[] = [];
  const eligible: Eligible[] = [];
  for (const asset of assets) {
    const reason = eligibilityFailure(asset);
    if (reason) {
      excluded.push({ ticker: asset.ticker, rank: asset.rank, reason });
      continue;
    }
    const price = asset.price!;
    const ceiling = asset.ceiling!;
    const value = positionValue(asset);
    const target = asset.weight * total;
    const gap = target - value;
    // Os multiplicadores só valem para quem está abaixo da meta.
    const byMargin = gap > 0 ? marginMultiplier((ceiling - price) / ceiling) : 1;
    const byPriceToBook = gap > 0 ? priceToBookMultiplier(asset.priceToBook) : 1;
    const adjustedGap = gap > 0 ? gap * byMargin * byPriceToBook : 0;
    eligible.push({
      ...asset,
      price,
      rank: asset.rank!,
      ceiling,
      value,
      target,
      marginMultiplier: byMargin,
      priceToBookMultiplier: byPriceToBook,
      adjustedGap,
      // Arredonda para a cota mais próxima: só compra se o gap ajustado pagar meia cota ou mais.
      desired: Math.floor(adjustedGap / price + 0.5),
      bought: 0,
      fromLeftover: 0,
    });
  }
  eligible.sort(byRankThenTicker);

  let cash = budget;
  // Cotas desejadas que ainda faltam comprar.
  const wanted = (asset: Eligible) => Math.max(0, asset.desired - asset.bought);
  const affordable = (asset: Eligible) => Math.floor(cash / asset.price + EPSILON);

  // Passo 1: cascata pelo ranking, cada ativo até as cotas desejadas. Se o dinheiro não alcança um
  // ativo, ele compra o que der e a cascata segue para os próximos (um mais barato ainda pode caber).
  for (const asset of eligible) {
    const quantity = Math.min(wanted(asset), affordable(asset));
    if (quantity > 0) {
      asset.bought += quantity;
      cash = round2(cash - quantity * asset.price);
    }
  }

  // Passo 2: sobra. Só quando todos os elegíveis compraram as cotas desejadas; senão o dinheiro fica
  // guardado para o próximo aporte do ativo que ainda pede cotas.
  if (eligible.every((asset) => wanted(asset) === 0)) {
    const weightVsTarget = (asset: Eligible) =>
      (asset.value + asset.bought * asset.price) / asset.target;
    const discountToAverage = (asset: Eligible) =>
      asset.averagePrice && asset.averagePrice > 0
        ? (asset.averagePrice - asset.price) / asset.averagePrice
        : 0;
    for (let step = 0; step < MAX_LEFTOVER_STEPS; step++) {
      const candidates = eligible.filter(
        (asset) => asset.target > 0 && asset.price <= cash + EPSILON,
      );
      if (candidates.length === 0) break;
      candidates.sort(
        (a, b) =>
          weightVsTarget(a) - weightVsTarget(b) ||
          discountToAverage(b) - discountToAverage(a) ||
          a.rank - b.rank,
      );
      const pick = candidates[0]!;
      pick.bought += 1;
      pick.fromLeftover += 1;
      cash = round2(cash - pick.price);
    }
  }

  const spent = round2(budget - cash);
  const totalAfter = strategyValue + spent;
  const orders: CascadeOrder[] = eligible
    .filter((asset) => asset.bought > 0)
    .map((asset) => {
      const total = round2(asset.bought * asset.price);
      return {
        ticker: asset.ticker,
        rank: asset.rank,
        quantity: asset.bought,
        fromLeftover: asset.fromLeftover,
        price: asset.price,
        total,
        weightBefore: strategyValue > 0 ? asset.value / strategyValue : 0,
        weightAfter: totalAfter > 0 ? (asset.value + asset.bought * asset.price) / totalAfter : 0,
        targetWeight: asset.weight,
        marginToCeiling: (asset.ceiling - asset.price) / asset.ceiling,
        priceToBook: asset.priceToBook,
        marginMultiplier: asset.marginMultiplier,
        priceToBookMultiplier: asset.priceToBookMultiplier,
        gapBefore: round2(asset.target - asset.value),
        adjustedGap: round2(asset.adjustedGap),
        desired: asset.desired,
        gapAfter: round2(asset.target - (asset.value + asset.bought * asset.price)),
      };
    });

  for (const asset of eligible) {
    if (asset.bought === 0) {
      excluded.push({
        ticker: asset.ticker,
        rank: asset.rank,
        reason: wanted(asset) > 0 ? "SEM_SALDO" : "NA_META",
      });
    }
  }
  excluded.sort(byRankThenTicker);

  return {
    amount: budget,
    spent,
    leftover: round2(budget - spent),
    strategyValue,
    orders,
    excluded,
  };
}

export type AportePriority =
  | { kind: "fila"; position: number }
  | { kind: "fora"; reason: Exclude<ExclusionReason, "SEM_SALDO"> };

/**
 * "Prioridade de aporte" (a coluna que substitui o IPA): a cascata com aporte zero.
 * Os elegíveis abaixo da meta formam a fila, na ordem do ranking; os outros mostram o motivo.
 */
export function aportePriorities(assets: readonly CascadeAsset[]): Map<string, AportePriority> {
  const { excluded } = sunoCascade(0, assets);
  const priorities = new Map<string, AportePriority>();
  let position = 0;
  for (const item of excluded) {
    if (item.reason === "SEM_SALDO") {
      priorities.set(item.ticker, { kind: "fila", position: ++position });
    } else {
      priorities.set(item.ticker, { kind: "fora", reason: item.reason });
    }
  }
  return priorities;
}

export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  SEM_COTACAO: "Sem cotação",
  SEM_RANKING: "Sem ranking",
  SEM_TETO: "Sem preço teto",
  ACIMA_DO_TETO: "Acima do teto",
  NA_META: "Já na meta",
  SEM_SALDO: "Faltou saldo",
};
