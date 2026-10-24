import { TriangleAlertIcon } from "lucide-react";
import type { StrategyRow } from "@/features/portfolio";
import { formatPercent } from "@/shared/lib/format";

/** Margem até o teto, com o alerta de teto suspeito (âmbar, com ícone e rótulo). */
export function MarginValue({ row }: { row: StrategyRow }) {
  return (
    <span className="inline-flex items-center gap-1">
      {row.suspiciousCeiling ? (
        <TriangleAlertIcon className="size-3.5 text-warn" aria-label="Teto suspeito" />
      ) : null}
      {row.marginToCeiling === null ? "—" : formatPercent(row.marginToCeiling, 1)}
    </span>
  );
}

/** Peso atual na estratégia / peso-alvo. */
export function WeightValue({ row }: { row: StrategyRow }) {
  return row.strategyWeight === null || row.targetWeight === null
    ? "—"
    : `${formatPercent(row.strategyWeight, 1)} / ${formatPercent(row.targetWeight, 1)}`;
}
