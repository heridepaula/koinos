import { round2 } from "@/shared/lib/money";

// Motor de aporte pelo método Suno (orientações públicas da Suno no Suno Conecta):
// 1. só comprar abaixo do preço teto;
// 2. seguir o ranking respeitando a % sugerida: levar o 1º até a meta, depois o 2º, e assim por diante;
// 3. se todos estiverem abaixo do teto e na meta, aportar no de menor peso ou mais abaixo do preço médio.
// Na acumulação, a carteira se rebalanceia pelos aportes, sem vender.
// Entrada aos poucos ("investir aos poucos, distribuindo as compras ao longo de alguns meses"):
// nenhum ativo leva mais que uma parte do aporte. Uma posição nova se monta em vários aportes,
// e o preço médio se forma em várias compras.

export type CascadeAsset = {
  ticker: string;
  rank: number | null;
  ceiling: number | null;
  /** Peso-alvo efetivo na estratégia, como fração (os pesos da estratégia somam 1). */
  weight: number;
  price: number | null;
  quantity: number;
  averagePrice: number | null;
};

export type ExclusionReason =
  "SEM_COTACAO" | "SEM_RANKING" | "SEM_TETO" | "ACIMA_DO_TETO" | "NA_META" | "SEM_SALDO";

/** Limites por ativo que a tela oferece, em % do aporte. 100 = sem limite. */
export const MAX_SHARE_PERCENTS = [25, 33, 50, 75, 100] as const;
export type MaxSharePercent = (typeof MAX_SHARE_PERCENTS)[number];
/** Padrão da entrada aos poucos: nenhum ativo leva mais que metade do aporte. */
export const DEFAULT_MAX_SHARE_PERCENT: MaxSharePercent = 50;

export type CascadeOptions = {
  /** Máximo que um ativo pode receber neste aporte, em %. 100 ou mais = sem limite. */
  maxSharePercent?: number;
};

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
  /** Quanto faltava (R$) para a meta antes do aporte. */
  gapBefore: number;
  /** Parou no limite por ativo com o ativo ainda abaixo da meta (entrada aos poucos). */
  limited: boolean;
  /** Quanto falta (R$) para a meta depois desta ordem. */
  gapAfter: number;
  /** Só em ordem limitada: quantos aportes iguais a este ainda faltam para a meta (estimativa). */
  aportesLeft: number | null;
};

export type CascadeExclusion = { ticker: string; rank: number | null; reason: ExclusionReason };

export type CascadeResult = {
  amount: number;
  spent: number;
  leftover: number;
  /** Valor atual dos ativos da estratégia (antes do aporte). */
  strategyValue: number;
  /** Limite por ativo usado, em % do aporte (100 = sem limite). */
  maxSharePercent: number;
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

export function sunoCascade(
  amount: number,
  assets: readonly CascadeAsset[],
  { maxSharePercent = DEFAULT_MAX_SHARE_PERCENT }: CascadeOptions = {},
): CascadeResult {
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
    eligible.push({
      ...asset,
      price: asset.price!,
      rank: asset.rank!,
      ceiling: asset.ceiling!,
      value: positionValue(asset),
      target: asset.weight * total,
      bought: 0,
      fromLeftover: 0,
    });
  }
  eligible.sort(byRankThenTicker);

  let cash = budget;
  // Cotas que aproximam o ativo da meta: arredonda para a cota mais próxima (só compra se faltar ≥ meia cota).
  const wanted = (asset: Eligible) => {
    const gap = asset.target - (asset.value + asset.bought * asset.price);
    return gap > 0 ? Math.floor(gap / asset.price + 0.5) : 0;
  };
  const affordable = (asset: Eligible) => Math.floor(cash / asset.price + EPSILON);
  // Entrada aos poucos: teto de cotas por ativo neste aporte, com pelo menos 1 cota (senão um
  // ativo caro nunca entraria com aportes pequenos). Com 100%, não há teto.
  const limit = maxSharePercent >= 100 ? Infinity : (maxSharePercent / 100) * budget;
  const maxQuantity = (asset: Eligible) => Math.max(1, Math.floor(limit / asset.price + EPSILON));
  const room = (asset: Eligible) => maxQuantity(asset) - asset.bought;

  // Passo 1: cascata pelo ranking, cada ativo até a meta ou até o limite. Se o dinheiro não
  // alcança um ativo, segue para os próximos (um mais barato ainda pode caber).
  for (const asset of eligible) {
    const quantity = Math.min(wanted(asset), room(asset), affordable(asset));
    if (quantity > 0) {
      asset.bought += quantity;
      cash = round2(cash - quantity * asset.price);
    }
  }

  // Passo 2: sobra. Só quando todos os elegíveis estão na meta ou no limite; senão o dinheiro
  // fica guardado para o próximo aporte do ativo que ainda está abaixo dela.
  if (eligible.every((asset) => wanted(asset) === 0 || room(asset) <= 0)) {
    const weightVsTarget = (asset: Eligible) =>
      (asset.value + asset.bought * asset.price) / asset.target;
    const discountToAverage = (asset: Eligible) =>
      asset.averagePrice && asset.averagePrice > 0
        ? (asset.averagePrice - asset.price) / asset.averagePrice
        : 0;
    for (let step = 0; step < MAX_LEFTOVER_STEPS; step++) {
      const candidates = eligible.filter(
        (asset) => asset.target > 0 && asset.price <= cash + EPSILON && room(asset) > 0,
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
      const limited = room(asset) <= 0 && wanted(asset) > 0;
      const total = round2(asset.bought * asset.price);
      // Cada aporte igual compra cerca do mesmo total, e a meta cresce peso × aporte.
      const pace = total - asset.weight * budget;
      const gapAfter = round2(asset.target - (asset.value + asset.bought * asset.price));
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
        gapBefore: round2(asset.target - asset.value),
        limited,
        gapAfter,
        aportesLeft: limited && pace > 0 ? Math.ceil(gapAfter / pace) : null,
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
    maxSharePercent,
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
