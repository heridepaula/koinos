"use client";

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { SortDirection } from "@/shared/lib/sort";
import { cn } from "@/shared/lib/utils";
import { TableHead } from "@/shared/ui/table";

export function SortableHead({
  active,
  direction,
  onSort,
  align = "left",
  className,
  children,
}: {
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
  align?: "left" | "right";
  className?: string;
  children: ReactNode;
}) {
  const Icon = !active ? ArrowUpDownIcon : direction === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <TableHead
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn(align === "right" && "text-right", className)}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active && "text-foreground",
        )}
      >
        {children}
        <Icon className="size-3.5 opacity-60" aria-hidden="true" />
      </button>
    </TableHead>
  );
}
