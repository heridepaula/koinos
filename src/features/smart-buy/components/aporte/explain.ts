import { formatBRL, formatPercent } from "@/shared/lib/format";
import type { CascadeOrder, ExclusionReason, MaxSharePercent } from "../../domain/suno-cascade";

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

export const limitLabel = (percent: MaxSharePercent) =>
  percent >= 100 ? "Sem limite" : `${percent}% do aporte`;

/** O porquê de cada ordem: posição no ranking, margem até o teto, quanto faltava e o limite. */
export function explain(order: CascadeOrder, maxSharePercent: number): string {
  const parts = [
    `${order.rank}º do ranking`,
    `${formatPercent(order.marginToCeiling, 1)} abaixo do teto`,
    order.gapBefore > 0 ? `faltavam ${formatBRL(order.gapBefore)} para a meta` : "já na meta",
  ];
  if (order.limited) {
    parts.push(`limite de ${maxSharePercent}% do aporte`);
    // Estimativa: mesmo aporte, mesmo preço e mesmo ranking.
    if (order.aportesLeft !== null) {
      parts.push(
        order.aportesLeft === 1
          ? "falta ≈ 1 aporte como este"
          : `faltam ≈ ${order.aportesLeft} aportes como este`,
      );
    }
  }
  if (order.fromLeftover > 0) parts.push(`${order.fromLeftover} cota(s) da sobra`);
  return parts.join(" · ");
}
