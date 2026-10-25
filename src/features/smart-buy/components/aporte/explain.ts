import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import type { CascadeOrder, ExclusionReason } from "../../domain/suno-cascade";

export const REASON_HELP: Record<ExclusionReason, string> = {
  ACIMA_DO_TETO: "Preço igual ou acima do teto: a regra é só comprar abaixo dele.",
  NA_META: "Já está na % sugerida (ou passou dela).",
  SEM_SALDO: "Está abaixo da meta, mas o valor não alcançou: fica para o próximo aporte.",
  SEM_TETO: "Sem preço teto cadastrado na Carteira Alvo.",
  SEM_RANKING: "Sem ranking cadastrado na Carteira Alvo.",
  SEM_COTACAO: "Ainda sem cotação.",
};

export const REASON_ORDER: ExclusionReason[] = [
  "SEM_SALDO",
  "NA_META",
  "ACIMA_DO_TETO",
  "SEM_TETO",
  "SEM_RANKING",
  "SEM_COTACAO",
];

/** " (×1,2)" quando o multiplicador muda o pedido; nada quando é neutro. */
const times = (multiplier: number) => (multiplier === 1 ? "" : ` (×${formatQuantity(multiplier)})`);

/**
 * O porquê de cada ordem: posição no ranking, margem até o teto e P/VP (com os multiplicadores do
 * Índice de Convicção), quanto faltava e quanto o FII pediu.
 */
export function explain(order: CascadeOrder): string {
  const conviction = order.marginMultiplier * order.priceToBookMultiplier;
  const parts = [
    `${order.rank}º do ranking`,
    `${formatPercent(order.marginToCeiling, 1)} abaixo do teto${times(order.marginMultiplier)}`,
  ];
  if (order.priceToBook !== null) {
    parts.push(`P/VP ${formatQuantity(order.priceToBook)}${times(order.priceToBookMultiplier)}`);
  }
  parts.push(
    order.gapBefore > 0 ? `faltavam ${formatBRL(order.gapBefore)} para a meta` : "já na meta",
  );
  if (order.gapBefore > 0 && conviction !== 1) {
    parts.push(`convicção ×${formatQuantity(conviction)}: pediu ${formatBRL(order.adjustedGap)}`);
  }
  if (order.fromLeftover > 0) parts.push(`${order.fromLeftover} cota(s) da sobra`);
  return parts.join(" · ");
}
