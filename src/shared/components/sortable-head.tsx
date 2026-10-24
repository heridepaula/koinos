"use client";

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { SortDirection } from "@/shared/lib/sort";
import { cn } from "@/shared/lib/utils";
import { TableHead } from "@/shared/ui/table";

/**
 * Cabeçalho ordenável. Como no Finder, só a coluna ordenada mostra a seta. O botão ocupa a altura
 * do cabeçalho (40 px; 44 no toque), para o alvo não ser só o texto.
 */
export function SortableHead({
  active,
  direction,
  onSort,
  align = "left",
  className,
  title,
  children,
}: {
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
  align?: "left" | "right";
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const Icon = direction === "asc" ? ChevronUpIcon : ChevronDownIcon;
  return (
    <TableHead
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn(align === "right" && "text-right", className)}
    >
      <button
        type="button"
        onClick={onSort}
        title={title}
        className={cn(
          "inline-flex h-10 items-center gap-1 rounded-sm whitespace-nowrap outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11",
          align === "right" && "flex-row-reverse",
          active && "text-foreground",
        )}
      >
        {children}
        {active ? <Icon className="size-3.5" aria-hidden="true" /> : null}
      </button>
    </TableHead>
  );
}
