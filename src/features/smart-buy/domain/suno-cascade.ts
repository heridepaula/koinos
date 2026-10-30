import { round2 } from "@/shared/lib/money";
import {
  dividendRatio,
  dividendTensor,
  safetyTensor,
  vacancyTensor,
  valuationTensor,
} from "./conviction";
import { RISK_CAPS, type RiskMacro } from "./risk";

// Motor de aporte Koinos 3.0 (documento do dono, 30/10/2026): cascata pelo ranking Suno, com
// valuation contínuo e travas de risco. Nunca vende: o rebalanceamento é só com dinheiro novo.
// 1. Elegível: na estratégia, com ranking, teto, cotação e preço abaixo do teto.
// 2. Meta = peso × (estratégia + aporte); gap = meta − valor. Com gap > 0, o FII pede o gap vezes os
//    tensores de valuation, proventos, segurança e vacância (conviction.ts).
// 3. Passo 1, do 1º ao último do ranking: cada FII gasta o menor entre o pedido e o espaço que sobra
//    no próprio FII (20% do aporte), no setor (35%), na macro, papel ou tijolo (60%), e no saldo, em
//    cotas inteiras (risk.ts).
// 4. Passo 2, a sobra: uma cota por vez para o FII mais abaixo da meta, dentro das mesmas travas, até
//    nenhuma cota caber. Nesta conta a meta vem descontada pelos freios de proventos e de vacância:
//    senão o FII freado, que costuma ser o mais abaixo da meta, voltaria a receber pela sobra.

export type CascadeAsset = {
  ticker: string;
  rank: number | null;
  ceiling: number | null;
  /** Peso-alvo efetivo na estratégia, como fração (os pesos da estratégia somam 1). */
  weight: number;
  price: number | null;
  quantity: number;
  averagePrice: number | null;
  /** P/VP do fechamento (cron das 2h). Null sem dado: tensor neutro. */
  priceToBook: number | null;
  /** Último provento por cota e a soma dos últimos 12 meses. Null sem histórico. */
  lastDividend: number | null;
  dividends12m: number | null;
  /** Vacância física, como fração (0,05 = 5%). Só freia tijolo. */
  vacancy: number | null;
  /** Baldes das travas de risco (risk.ts). Setor null: não divide o limite com outros FIIs. */
  macro: RiskMacro;
  sector: string | null;
};

export type ExclusionReason =
  | "SEM_COTACAO"
  | "SEM_RANKING"
  | "SEM_TETO"
  | "ACIMA_DO_TETO"
  | "NA_META"
  | "PEDIDO_PEQUENO"
  | "LIMITE_ATIVO"
  | "LIMITE_SETOR"
  | "LIMITE_MACRO"
  | "SEM_SALDO";

/** O que segurou o passo 1 abaixo do pedido. */
export type CascadeLimit = "ativo" | "setor" | "macro" | "saldo";

export type Tensors = { valuation: number; dividends: number; safety: number; vacancy: number };

export type CascadeOrder = {
  ticker: string;
  rank: number;
  quantity: number;
  /** Cotas que vieram do passo 2 (sobra). */
  fromLeftover: number;
  price: number;
  total: number;
  /** Peso na estratégia antes (÷ valor da estratégia) e depois (÷ estratégia + gasto). */
  weightBefore: number;
  weightAfter: number;
  targetWeight: number;
  /** (teto − preço) / teto */
  marginToCeiling: number;
  priceToBook: number | null;
  vacancy: number | null;
  /** Último provento ÷ média mensal de 12 meses, sem o teto de 1. Null sem histórico. */
  dividendRatio: number | null;
  tensors: Tensors;
  macro: RiskMacro;
  sector: string | null;
  /** Valor ÷ meta antes do aporte. */
  fillBefore: number;
  /** Quanto faltava (R$) para a meta antes do aporte. */
  gapBefore: number;
  /** Gap × tensores: quanto o FII pediu (R$). */
  need: number;
  /** A trava ou o saldo que cortou o pedido no passo 1. Null quando não cortou. */
  limitedBy: CascadeLimit | null;
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
  /** As travas deste aporte, em R$. */
  caps: { asset: number; sector: number; macro: number };
  /** Na ordem do ranking. */
  orders: CascadeOrder[];
  excluded: CascadeExclusion[];
};

const EPSILON = 1e-9;
const MAX_LEFTOVER_STEPS = 100_000;

type Slot = {
  readonly asset: CascadeAsset;
  readonly ticker: string;
  readonly rank: number;
  readonly price: number;
  readonly ceiling: number;
  readonly value: number;
  readonly target: number;
  readonly gap: number;
  readonly tensors: Tensors;
  readonly need: number;
  /** Meta da sobra: a meta descontada pelos freios de proventos e de vacância. */
  readonly leftoverTarget: number;
  bought: number;
  fromLeftover: number;
  limitedBy: CascadeLimit | null;
};

type EligibilityReason = "SEM_COTACAO" | "SEM_RANKING" | "SEM_TETO" | "ACIMA_DO_TETO";

/** A primeira regra de elegibilidade que falhar define o motivo de exclusão. */
function eligibilityFailure(asset: CascadeAsset): EligibilityReason | null {
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

/** A meta, o gap, os tensores e o pedido de cada elegível; os outros saem com o motivo. */
function prepare(amount: number, assets: readonly CascadeAsset[]) {
  const budget = Math.max(0, round2(amount));
  const strategyValue = assets.reduce((sum, asset) => sum + positionValue(asset), 0);
  const total = strategyValue + budget;
  const excluded: { ticker: string; rank: number | null; reason: EligibilityReason }[] = [];
  const slots: Slot[] = [];
  for (const asset of [...assets].sort(byRankThenTicker)) {
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
    const tensors: Tensors = {
      valuation: valuationTensor(asset.priceToBook),
      dividends: dividendTensor(asset.lastDividend, asset.dividends12m),
      safety: safetyTensor((ceiling - price) / ceiling),
      vacancy: vacancyTensor(asset.vacancy, asset.macro),
    };
    const need =
      gap > 0 ? gap * tensors.valuation * tensors.dividends * tensors.safety * tensors.vacancy : 0;
    slots.push({
      asset,
      ticker: asset.ticker,
      rank: asset.rank!,
      price,
      ceiling,
      value,
      target,
      gap,
      tensors,
      need,
      leftoverTarget: target * tensors.dividends * tensors.vacancy,
      bought: 0,
      fromLeftover: 0,
      limitedBy: null,
    });
  }
  return { budget, strategyValue, slots, excluded };
}

/** Pediu ao menos uma cota inteira. */
const asksForAShare = (slot: Slot) => slot.gap > 0 && slot.need >= slot.price - EPSILON;

function exclusionReason(slot: Slot): ExclusionReason {
  if (slot.gap <= 0) return "NA_META";
  if (!asksForAShare(slot)) return "PEDIDO_PEQUENO";
  switch (slot.limitedBy) {
    case "ativo":
      return "LIMITE_ATIVO";
    case "setor":
      return "LIMITE_SETOR";
    case "macro":
      return "LIMITE_MACRO";
    default:
      return "SEM_SALDO";
  }
}

export function sunoCascade(amount: number, assets: readonly CascadeAsset[]): CascadeResult {
  const { budget, strategyValue, slots, excluded } = prepare(amount, assets);
  const caps = {
    asset: RISK_CAPS.asset * budget,
    sector: RISK_CAPS.sector * budget,
    macro: RISK_CAPS.macro * budget,
  };
  const usedBySector = new Map<string, number>();
  const usedByMacro = new Map<RiskMacro, number>();
  let cash = budget;

  const spentOn = (slot: Slot) => slot.bought * slot.price;
  /** Espaço em cada balde, em R$, na ordem usada para dizer qual trava cortou o pedido. */
  const spaces = (slot: Slot): [CascadeLimit, number][] => [
    ["ativo", caps.asset - spentOn(slot)],
    [
      "setor",
      slot.asset.sector === null
        ? Infinity
        : caps.sector - (usedBySector.get(slot.asset.sector) ?? 0),
    ],
    ["macro", caps.macro - (usedByMacro.get(slot.asset.macro) ?? 0)],
    ["saldo", cash],
  ];
  const tightest = (slot: Slot) =>
    spaces(slot).reduce((min, entry) => (entry[1] < min[1] ? entry : min));
  const buy = (slot: Slot, shares: number, leftover: boolean) => {
    const cost = shares * slot.price;
    slot.bought += shares;
    if (leftover) slot.fromLeftover += shares;
    if (slot.asset.sector !== null) {
      usedBySector.set(slot.asset.sector, (usedBySector.get(slot.asset.sector) ?? 0) + cost);
    }
    usedByMacro.set(slot.asset.macro, (usedByMacro.get(slot.asset.macro) ?? 0) + cost);
    cash = round2(cash - cost);
  };

  // Passo 1: a cascata pelo ranking, com as travas.
  for (const slot of slots) {
    if (slot.need <= 0) continue;
    const [binding, allowed] = tightest(slot);
    const shares = Math.floor(Math.min(slot.need, allowed) / slot.price + EPSILON);
    if (shares > 0) buy(slot, shares, false);
    if (allowed < slot.need) slot.limitedBy = binding;
  }

  // Passo 2: a sobra, uma cota por vez para o mais abaixo da meta (no empate, o melhor ranking).
  const leftoverFill = (slot: Slot) => (slot.value + spentOn(slot)) / slot.leftoverTarget;
  for (let step = 0; step < MAX_LEFTOVER_STEPS; step++) {
    const pick = slots.reduce<Slot | null>((best, slot) => {
      if (!(slot.leftoverTarget > 0) || slot.price > tightest(slot)[1] + EPSILON) return best;
      return best === null || leftoverFill(slot) < leftoverFill(best) ? slot : best;
    }, null);
    if (pick === null) break;
    buy(pick, 1, true);
  }

  const spent = round2(budget - cash);
  const strategyAfter = strategyValue + spent;
  const orders: CascadeOrder[] = slots
    .filter((slot) => slot.bought > 0)
    .map((slot) => {
      const held = slot.value + spentOn(slot);
      return {
        ticker: slot.ticker,
        rank: slot.rank,
        quantity: slot.bought,
        fromLeftover: slot.fromLeftover,
        price: slot.price,
        total: round2(spentOn(slot)),
        weightBefore: strategyValue > 0 ? slot.value / strategyValue : 0,
        weightAfter: strategyAfter > 0 ? held / strategyAfter : 0,
        targetWeight: slot.asset.weight,
        marginToCeiling: (slot.ceiling - slot.price) / slot.ceiling,
        priceToBook: slot.asset.priceToBook,
        vacancy: slot.asset.vacancy,
        dividendRatio: dividendRatio(slot.asset.lastDividend, slot.asset.dividends12m),
        tensors: slot.tensors,
        macro: slot.asset.macro,
        sector: slot.asset.sector,
        fillBefore: slot.target > 0 ? slot.value / slot.target : 0,
        gapBefore: round2(slot.gap),
        need: round2(slot.need),
        limitedBy: slot.limitedBy,
        gapAfter: round2(slot.target - held),
      };
    });

  const unbought = slots
    .filter((slot) => slot.bought === 0)
    .map((slot): CascadeExclusion => ({
      ticker: slot.ticker,
      rank: slot.rank,
      reason: exclusionReason(slot),
    }));

  return {
    amount: budget,
    spent,
    leftover: round2(budget - spent),
    strategyValue,
    caps,
    orders,
    excluded: [...excluded, ...unbought].sort(byRankThenTicker),
  };
}

/** Motivos que não dependem do aporte: valem para a coluna Prioridade. */
type StaticReason = EligibilityReason | "NA_META" | "PEDIDO_PEQUENO";

export type AportePriority =
  { kind: "fila"; position: number } | { kind: "fora"; reason: StaticReason };

/**
 * "Prioridade de aporte" (a coluna que substitui o IPA), com aporte zero: os elegíveis que pedem ao
 * menos uma cota formam a fila, na ordem do ranking; os outros mostram o motivo.
 */
export function aportePriorities(assets: readonly CascadeAsset[]): Map<string, AportePriority> {
  const { slots, excluded } = prepare(0, assets);
  const priorities = new Map<string, AportePriority>();
  let position = 0;
  for (const slot of slots) {
    priorities.set(
      slot.ticker,
      asksForAShare(slot)
        ? { kind: "fila", position: ++position }
        : { kind: "fora", reason: slot.gap <= 0 ? "NA_META" : "PEDIDO_PEQUENO" },
    );
  }
  for (const item of excluded) priorities.set(item.ticker, { kind: "fora", reason: item.reason });
  return priorities;
}

export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  SEM_COTACAO: "Sem cotação",
  SEM_RANKING: "Sem ranking",
  SEM_TETO: "Sem preço teto",
  ACIMA_DO_TETO: "Acima do teto",
  NA_META: "Já na meta",
  PEDIDO_PEQUENO: "Pede menos de 1 cota",
  LIMITE_ATIVO: "Cota acima do limite",
  LIMITE_SETOR: "Limite do setor",
  LIMITE_MACRO: "Limite de papel ou tijolo",
  SEM_SALDO: "Faltou saldo",
};
