import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import type { MergedOrder } from "../../domain/merge-orders";
import { RISK_CAPS } from "../../domain/risk";
import type { StockBuyOrder, StockExclusionReason } from "../../domain/stock-buy";
import type { CascadeOrder, ExclusionReason } from "../../domain/suno-cascade";

/** A classe de uma ordem ou de um ativo de fora: FII ou ação. */
export type OrderKind = MergedOrder["kind"];

/** "cota(s)" nos FIIs e "ação(ões)" nas ações, conforme a quantidade. */
export function unitOf(kind: OrderKind, quantity: number): string {
  if (kind === "FII") return quantity === 1 ? "cota" : "cotas";
  return quantity === 1 ? "ação" : "ações";
}

/** O texto de ajuda de cada motivo quando só há FIIs nele. */
export const REASON_HELP: Record<ExclusionReason, string> = {
  ACIMA_DO_TETO: "Preço igual ou acima do teto: a regra é só comprar abaixo dele.",
  AGUARDAR: "Marcado como Aguardar na Carteira Alvo: não recebe aporte.",
  NA_META: "Já está na % sugerida (ou passou dela).",
  PEDIDO_PEQUENO:
    "Falta pouco para a meta, ou os freios de provento e vacância cortaram o pedido: não chega a uma cota.",
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
  "PEDIDO_PEQUENO",
  "NA_META",
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

/** " (×1,16)" quando o tensor mexe no pedido; nada quando é neutro. */
const times = (tensor: number) =>
  Math.abs(tensor - 1) < 0.005 ? "" : ` (×${formatQuantity(tensor)})`;

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

/**
 * O porquê completo de uma ordem, em partes: ranking, distância da meta, cada tensor que mexeu no
 * pedido, o pedido, a trava que o cortou e as cotas da sobra. Vai para a folha do celular e para
 * a dica da tabela.
 */
export function explain(order: CascadeOrder): string[] {
  const { tensors } = order;
  const parts = [`${order.rank}º do ranking`];
  parts.push(
    order.gapBefore > 0
      ? `faltavam ${formatBRL(order.gapBefore)} (${formatPercent(1 - order.fillBefore, 0)}) para a meta`
      : "já na meta",
  );
  // Os tensores só mexem no pedido de quem está abaixo da meta: na meta, a compra veio da sobra.
  if (order.gapBefore > 0) {
    if (order.priceToBook !== null) {
      parts.push(`P/VP ${formatQuantity(order.priceToBook)}${times(tensors.valuation)}`);
    }
    parts.push(`${formatPercent(order.marginToCeiling, 1)} abaixo do teto${times(tensors.safety)}`);
    if (order.dividendRatio !== null && tensors.dividends < 1) {
      parts.push(
        `último provento ${formatPercent(order.dividendRatio, 0)} da média de 12 meses${times(tensors.dividends)}`,
      );
    }
    if (order.macro === "Tijolo" && order.vacancy !== null && order.vacancy > 0) {
      parts.push(`vacância de ${formatPercent(order.vacancy, 1)}${times(tensors.vacancy)}`);
    }
    parts.push(`pediu ${formatBRL(order.need)}`);
  }
  const limit = limitText(order);
  if (limit) parts.push(limit);
  if (order.fromLeftover > 0) parts.push(`${order.fromLeftover} cota(s) da sobra`);
  return parts;
}

/**
 * Um comentário curto do porquê da recomendação: a posição no ranking e a distância da meta, mais
 * o sinal que mais pesou (uma trava, um freio ou o desconto).
 */
export function shortReason(order: CascadeOrder): string {
  const shortfall = 1 - order.fillBefore;
  const distance =
    order.gapBefore <= 0
      ? "já na meta"
      : shortfall < 0.005
        ? "quase na meta"
        : `${formatPercent(shortfall, 0)} abaixo da meta`;
  if (onlyLeftover(order)) return `Sobra do aporte · ${distance}`;
  const { tensors } = order;
  const parts = [`${order.rank}º do ranking`, distance];
  if (order.limitedBy === "setor" || order.limitedBy === "macro") {
    parts.push(
      order.limitedBy === "setor" ? "limite do setor" : `limite de ${order.macro.toLowerCase()}`,
    );
  } else if (tensors.dividends < 0.95) {
    parts.push("provento caiu");
  } else if (tensors.vacancy < 0.9) {
    parts.push(`vacância de ${formatPercent(order.vacancy ?? 0, 0)}`);
  } else if (order.priceToBook !== null && tensors.valuation >= 1.05) {
    parts.push(`P/VP ${formatQuantity(order.priceToBook)}`);
  } else if (tensors.safety >= 1.1) {
    parts.push(`${formatPercent(order.marginToCeiling, 0)} abaixo do teto`);
  }
  return parts.join(" · ");
}

/** O porquê completo de uma ordem de ação: a margem de segurança e o que faltava para a meta. */
export function explainStock(order: StockBuyOrder): string {
  const ceiling = order.price * (1 + order.marginOfSafety);
  return `Margem de segurança de ${formatPercent(order.marginOfSafety, 0)} (teto ${formatBRL(ceiling)}, preço ${formatBRL(order.price)}) · faltavam ${formatBRL(order.deficitBefore)} para a meta de ${formatPercent(order.targetWeight, 1)}`;
}

/**
 * A linha curta de uma ordem de ação. A margem de segurança (teto ÷ preço − 1) não é o quanto o
 * preço está abaixo do teto, a conta dos FIIs: por isso vai com o nome.
 */
export function shortStockReason(order: StockBuyOrder): string {
  return `margem de segurança de ${formatPercent(order.marginOfSafety, 0)} · faltavam ${formatBRL(order.deficitBefore)}`;
}
