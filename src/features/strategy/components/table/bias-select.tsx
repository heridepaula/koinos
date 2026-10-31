"use client";

import type { StrategyRow } from "@/features/portfolio";
import { cn } from "@/shared/lib/utils";
import { NativeSelect } from "@/shared/ui/native-select";
import { BIASES, BIAS_LABELS, type Bias } from "../../domain/bias";

/** Viés da ação: "Aguardar" tira a ação das compras; sem viés, ela entra pela margem até o teto. */
export function BiasSelect({
  row,
  onChange,
  quiet,
  className,
}: {
  row: StrategyRow;
  onChange: (bias: Bias | null) => void;
  /** Mesmos estilos do `CategorySelect`: "table" sobre o card, "sheet" dentro dos grupos da folha. */
  quiet?: "table" | "sheet";
  className?: string;
}) {
  return (
    <NativeSelect
      aria-label={`Viés de ${row.ticker}`}
      wrapperClassName={className}
      className={cn(
        quiet && "border-transparent hover:border-input",
        quiet === "table" && "bg-secondary/60 dark:bg-secondary/60",
        quiet === "sheet" && "bg-card dark:bg-card",
      )}
      value={row.bias ?? ""}
      onChange={(event) => onChange((event.target.value || null) as Bias | null)}
    >
      <option value="">—</option>
      {BIASES.map((bias) => (
        <option key={bias} value={bias}>
          {BIAS_LABELS[bias]}
        </option>
      ))}
    </NativeSelect>
  );
}
