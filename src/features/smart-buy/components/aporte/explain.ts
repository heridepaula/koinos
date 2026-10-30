import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import { RISK_CAPS } from "../../domain/risk";
import type { CascadeOrder, ExclusionReason } from "../../domain/suno-cascade";

export const REASON_HELP: Record<ExclusionReason, string> = {
  ACIMA_DO_TETO: "Preço igual ou acima do teto: a regra é só comprar abaixo dele.",
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
  "ACIMA_DO_TETO",
  "SEM_TETO",
  "SEM_RANKING",
  "SEM_COTACAO",
];

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
