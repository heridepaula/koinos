import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import type { MergedOrder } from "../../domain/merge-orders";
import { RISK_CAPS } from "../../domain/risk";
import type { StockBuyOrder, StockExclusionReason } from "../../domain/stock-buy";
import type { CascadeOrder, ExclusionReason } from "../../domain/fii-cascade";

/** A classe de uma ordem ou de um ativo de fora: FII ou ação. */
export type OrderKind = MergedOrder["kind"];

/** "cota(s)" nos FIIs e "ação(ões)" nas ações, conforme a quantidade. */
export function unitOf(kind: OrderKind, quantity: number): string {
  if (kind === "FII") return quantity === 1 ? "cota" : "cotas";
  return quantity === 1 ? "ação" : "ações";
}

/** O motivo só existe nas ações: o mesmo texto nas três tabelas de ajuda. */
const LESS_THAN_A_LOT_HELP =
  "O que faltava para a meta não chegava a um lote de 100 ações. Pode receber pela sobra, se for a mais abaixo da meta.";

/** O texto de ajuda de cada motivo quando só há FIIs nele. */
export const REASON_HELP: Record<ExclusionReason, string> = {
  ACIMA_DO_TETO: "Preço igual ou acima do teto: a regra é só comprar abaixo dele.",
  AGUARDAR: "Marcado como Aguardar na Carteira Alvo: não recebe aporte.",
  PROVENTO_SUSPENSO:
    "Pagava com regularidade e está há mais de 45 dias sem data ex, ou há mais de um ano sem pagar. Fica fora do aporte até voltar a pagar.",
  NA_META: "Já está na % sugerida (ou passou dela).",
  PEDIDO_PEQUENO:
    "Falta pouco para a meta, ou os freios de provento e vacância cortaram o pedido: não chega a uma cota.",
  MENOS_DE_UM_LOTE: LESS_THAN_A_LOT_HELP,
  ABAIXO_DO_MINIMO:
    "O pedido não chegava ao mínimo por ordem (aporte ÷ nº de FIIs da estratégia, até 12,5% do aporte). O dinheiro foi para os próximos da fila; no próximo aporte o pedido cresce.",
  LIMITE_ATIVO: `Uma cota custa mais que o limite de ${formatPercent(RISK_CAPS.asset, 0)} do aporte por FII.`,
  LIMITE_SETOR: `O setor já levou ${formatPercent(RISK_CAPS.sector, 0)} do aporte.`,
  LIMITE_MACRO: `Papel ou tijolo já levou ${formatPercent(RISK_CAPS.macro, 0)} do aporte.`,
  SEM_SALDO: "Está abaixo da meta, mas o valor não alcançou: fica para o próximo aporte.",
  SEM_TETO: "Sem preço teto cadastrado na Carteira Alvo.",
  SEM_RANKING: "Sem ranking cadastrado na Carteira Alvo.",
  SEM_COTACAO: "Ainda sem cotação.",
};

export const REASON_ORDER: ExclusionReason[] = [
  "SEM_SALDO",
  "LIMITE_SETOR",
  "LIMITE_MACRO",
  "LIMITE_ATIVO",
  "ABAIXO_DO_MINIMO",
  "PEDIDO_PEQUENO",
  "MENOS_DE_UM_LOTE",
  "NA_META",
  "PROVENTO_SUSPENSO",
  "AGUARDAR",
  "ACIMA_DO_TETO",
  "SEM_TETO",
  "SEM_RANKING",
  "SEM_COTACAO",
];

/** Os mesmos motivos quando só há ações neles (as ações não têm os motivos só de FIIs). */
export const STOCK_REASON_HELP: Record<StockExclusionReason, string> = {
  SEM_COTACAO: "Ainda sem cotação.",
  SEM_TETO: "Sem preço teto cadastrado na Carteira Alvo.",
  ACIMA_DO_TETO: "Preço acima do teto: a regra é só comprar abaixo dele.",
  AGUARDAR: "Marcada como Aguardar na Carteira Alvo: não recebe aporte.",
  NA_META: "Já está na % sugerida (ou passou dela).",
  PEDIDO_PEQUENO: "Falta pouco para a meta: não chega a uma ação.",
  MENOS_DE_UM_LOTE: LESS_THAN_A_LOT_HELP,
  SEM_SALDO: "Está abaixo da meta, mas o valor não alcançou: fica para o próximo aporte.",
};

/** Os motivos com FIIs e ações juntos: um texto que serve para as duas classes. */
export const NEUTRAL_REASON_HELP: Record<StockExclusionReason, string> = {
  SEM_COTACAO: "Ainda sem cotação.",
  SEM_TETO: "Sem preço teto cadastrado na Carteira Alvo.",
  ACIMA_DO_TETO:
    "Preço acima do teto (nos FIIs, também igual a ele): a regra é só comprar abaixo dele.",
  AGUARDAR: "Com viés Aguardar na Carteira Alvo: não recebe aporte.",
  NA_META: "Já está na % sugerida (ou passou dela).",
  PEDIDO_PEQUENO:
    "Falta pouco para a meta, ou os freios de provento e vacância dos FIIs cortaram o pedido: não chega a uma cota ou ação.",
  MENOS_DE_UM_LOTE: LESS_THAN_A_LOT_HELP,
  SEM_SALDO: "Está abaixo da meta, mas o valor não alcançou: fica para o próximo aporte.",
};

const isStockReason = (reason: ExclusionReason): reason is StockExclusionReason =>
  Object.hasOwn(STOCK_REASON_HELP, reason);

/**
 * O texto de ajuda de um motivo fala da classe dos ativos que estão nele: só FIIs, só ações ou as
 * duas juntas.
 */
export function reasonHelp(
  reason: ExclusionReason,
  assets: readonly { kind: OrderKind }[],
): string {
  const hasStock = assets.some((asset) => asset.kind === "ACAO");
  if (!hasStock || !isStockReason(reason)) return REASON_HELP[reason];
  const hasFii = assets.some((asset) => asset.kind === "FII");
  return hasFii ? NEUTRAL_REASON_HELP[reason] : STOCK_REASON_HELP[reason];
}

/** Um ativo da estratégia que ficou fora deste aporte, com a sua classe. */
export type ExcludedAsset = { ticker: string; kind: OrderKind };

/**
 * Os de fora das duas carteiras juntos, por motivo: em cada motivo, os FIIs (na ordem da cascata)
 * e depois as ações (na ordem do motor de ações).
 */
export function groupExcluded(
  fii: readonly { ticker: string; reason: ExclusionReason }[],
  stock: readonly { ticker: string; reason: StockExclusionReason }[],
): Map<ExclusionReason, ExcludedAsset[]> {
  const byReason = new Map<ExclusionReason, ExcludedAsset[]>();
  const add = (reason: ExclusionReason, asset: ExcludedAsset) => {
    const assets = byReason.get(reason);
    if (assets) assets.push(asset);
    else byReason.set(reason, [asset]);
  };
  for (const item of fii) add(item.reason, { ticker: item.ticker, kind: "FII" });
  for (const item of stock) add(item.reason, { ticker: item.ticker, kind: "ACAO" });
  return byReason;
}

const onlyLeftover = (order: CascadeOrder) => order.fromLeftover === order.quantity;

function limitText(order: CascadeOrder): string | null {
  switch (order.limitedBy) {
    case "ativo":
      return `limite de ${formatPercent(RISK_CAPS.asset, 0)} do aporte por FII`;
    case "setor":
      return `limite de ${formatPercent(RISK_CAPS.sector, 0)} do aporte em ${order.sector}`;
    case "macro":
      return `limite de ${formatPercent(RISK_CAPS.macro, 0)} do aporte em ${order.macro.toLowerCase()}`;
    case "saldo":
      return "o saldo acabou";
    default:
      return null;
  }
}

/** Os lotes que vieram do passo de sobra (a 3.1); vazio quando a ordem não teve sobra. */
function leftoverText(order: StockBuyOrder): string {
  return order.fromLeftover > 0 ? ` · ${order.fromLeftover / order.lot} lote(s) pela sobra` : "";
}

/** "faltam 5% para a meta", "quase na meta" ou "já na meta". */
function distanceWords(order: CascadeOrder): string {
  const shortfall = 1 - order.fillBefore;
  if (order.gapBefore <= 0) return "já na meta";
  if (shortfall < 0.005) return "quase na meta";
  return `faltam ${formatPercent(shortfall, 0)} para a meta`;
}

/**
 * A linha 1 do "Por quê" (spec por-que-na-tabela §7): a decisão do método em palavras, sem siglas
 * nem tensores. O sinal que mais pesou vem de uma trava, um freio ou do desconto.
 */
export function plainReason(order: CascadeOrder): string {
  if (onlyLeftover(order)) return `Sobra do aporte · ${distanceWords(order)}`;
  const { tensors } = order;
  const parts = [`${order.rank}º na lista do método`, distanceWords(order)];
  if (order.limitedBy === "setor" || order.limitedBy === "macro") {
    parts.push(
      order.limitedBy === "setor" ? "limite do setor" : `limite de ${order.macro.toLowerCase()}`,
    );
  } else if (tensors.dividends < 0.95) {
    parts.push("rendimento caiu");
  } else if (tensors.vacancy < 0.9) {
    parts.push(`vacância de ${formatPercent(order.vacancy ?? 0, 0)}`);
  } else if (order.priceToBook !== null && tensors.valuation >= 1.05) {
    parts.push("desconto no preço");
  } else if (tensors.safety >= 1.1) {
    parts.push("bem abaixo do teto");
  }
  return parts.join(" · ");
}

export type CalcEffect = "mais" | "menos";

/** Uma linha do "Cálculo do Koinos": o rótulo, o valor, o efeito no pedido e o multiplicador. */
export type CalcStep = {
  label: string;
  value: string;
  effect: CalcEffect | null;
  /** "×1,23", para o dono (no `title`); null quando o tensor é neutro. */
  exact: string | null;
};

/**
 * O caminho da conta em três números (spec por-que-na-tabela §8): quanto faltava para a meta, quanto
 * o método pediu (só FIIs: o que faltava × os fatores) e quanto comprou. `gap` e `need` são null na
 * meta (compra da sobra). Os R$ e a quantidade são da carteira: a tela os esconde no modo
 * privacidade.
 */
export type CalcFlow = {
  gap: number | null;
  need: number | null;
  total: number;
  quantity: number;
  unit: string;
  /** A trava que cortou o pedido ("limite de 25% do aporte por FII", "o saldo acabou"). */
  limit: string | null;
  /** Lote e sobra, em poucas palavras. */
  note: string | null;
};

const moved = (tensor: number) => Math.abs(tensor - 1) >= 0.005;
const effectOf = (tensor: number): CalcEffect | null =>
  moved(tensor) ? (tensor > 1 ? "mais" : "menos") : null;
const exactOf = (tensor: number) => (moved(tensor) ? `×${formatQuantity(tensor)}` : null);

/**
 * Os fatores que mexeram no pedido de um FII, um por linha (o rank está na linha da tabela e o que
 * faltava, no fluxo de `calcFlow`). Vazio na meta: a compra veio da sobra.
 */
export function calcSteps(order: CascadeOrder): CalcStep[] {
  const steps: CalcStep[] = [];
  if (order.gapBefore <= 0) return steps;
  const { tensors } = order;
  const step = (label: string, value: string, tensor: number) =>
    steps.push({ label, value, effect: effectOf(tensor), exact: exactOf(tensor) });
  if (order.priceToBook !== null && moved(tensors.valuation)) {
    step(
      "Preço sobre o patrimônio",
      `P/VP ${formatQuantity(order.priceToBook)}`,
      tensors.valuation,
    );
  }
  if (moved(tensors.safety)) {
    step("Margem até o teto", formatPercent(order.marginToCeiling, 0), tensors.safety);
  }
  if (order.dividendRatio !== null && tensors.dividends < 1 && moved(tensors.dividends)) {
    step(
      "Último rendimento",
      `${formatPercent(1 - order.dividendRatio, 0)} abaixo da média de 12 meses`,
      tensors.dividends,
    );
  }
  if (order.macro === "Tijolo" && order.vacancy !== null && moved(tensors.vacancy)) {
    step("Vacância", formatPercent(order.vacancy, 0), tensors.vacancy);
  }
  return steps;
}

/** O fluxo da conta de um FII: faltava → pediu → comprou, com a trava e a sobra. */
export function calcFlow(order: CascadeOrder): CalcFlow {
  const onTarget = order.gapBefore <= 0;
  const partial = order.fromLeftover > 0 && order.fromLeftover < order.quantity;
  return {
    gap: onTarget ? null : order.gapBefore,
    need: onTarget ? null : order.need,
    total: order.total,
    quantity: order.quantity,
    unit: unitOf("FII", order.quantity),
    limit: limitText(order),
    note: onTarget
      ? "compra da sobra do aporte"
      : partial
        ? `${order.fromLeftover} cota(s) da sobra`
        : null,
  };
}

/** A linha 1 das ações: a margem de segurança e o que faltava, com a sobra em lotes. */
export function plainStockReason(order: StockBuyOrder): string {
  const missing =
    order.deficitBefore <= 0
      ? "já estava na meta"
      : `faltavam ${formatBRL(order.deficitBefore)} para a meta`;
  return `Margem de segurança de ${formatPercent(order.marginOfSafety, 0)} · ${missing}${leftoverText(order)}`;
}

/** O fator das ações: a margem de segurança até o teto (o que faltava está no fluxo). */
export function stockCalcSteps(order: StockBuyOrder): CalcStep[] {
  const ceiling = order.price * (1 + order.marginOfSafety);
  return [
    {
      label: "Margem de segurança",
      value: `${formatPercent(order.marginOfSafety, 0)} (teto ${formatBRL(ceiling)})`,
      effect: null,
      exact: null,
    },
  ];
}

/** O fluxo da conta de uma ação: faltava → comprou (sem pedido com fatores), com lote e sobra. */
export function stockCalcFlow(order: StockBuyOrder): CalcFlow {
  const note = [
    order.lot > 1 ? `em lotes de ${order.lot}` : null,
    order.fromLeftover > 0 ? `${order.fromLeftover / order.lot} lote(s) da sobra` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    gap: order.deficitBefore > 0 ? order.deficitBefore : null,
    need: null,
    total: order.total,
    quantity: order.quantity,
    unit: unitOf("ACAO", order.quantity),
    limit: null,
    note: note || null,
  };
}
