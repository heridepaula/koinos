"use client";

import type { StrategyRow } from "@/features/portfolio";
import { cn } from "@/shared/lib/utils";
import { NativeSelect } from "@/shared/ui/native-select";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "../../domain/categories";

/** Categoria do ativo; sem uma escolhida, a primeira opção mostra a sugestão pelo subtipo. */
export function CategorySelect({
  row,
  onChange,
  quiet,
  className,
}: {
  row: StrategyRow;
  onChange: (category: Category | null) => void;
  /**
   * Sem borda até passar o mouse, como os campos numéricos: "table" sobre o card, com o
   * preenchimento leve; "sheet" dentro dos grupos da folha do celular, com o fundo do card.
   */
  quiet?: "table" | "sheet";
  className?: string;
}) {
  return (
    <NativeSelect
      aria-label={`Categoria de ${row.ticker}`}
      wrapperClassName={className}
      className={cn(
        quiet && "border-transparent hover:border-input",
        quiet === "table" && "bg-secondary/60 dark:bg-secondary/60",
        quiet === "sheet" && "bg-card dark:bg-card",
      )}
      value={row.category ?? ""}
      onChange={(event) => onChange((event.target.value || null) as Category | null)}
    >
      <option value="">
        {row.suggestedCategory
          ? `Sugestão: ${CATEGORY_LABELS[row.suggestedCategory]}`
          : "Sem categoria"}
      </option>
      {CATEGORIES.filter((category) => category !== "ACAO" || row.category === "ACAO").map(
        (category) => (
          <option key={category} value={category}>
            {CATEGORY_LABELS[category]}
          </option>
        ),
      )}
    </NativeSelect>
  );
}
