"use client";

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { SortDirection } from "@/shared/lib/sort";
import { cn } from "@/shared/lib/utils";
import { TableHead } from "@/shared/ui/table";

/** Cabeçalho ordenável. Como no Finder, só a coluna ordenada mostra a seta. */
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
          "inline-flex items-center gap-0.5 whitespace-nowrap hover:text-foreground",
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
