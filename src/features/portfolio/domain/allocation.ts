import { CATEGORY_LABELS, type Category } from "@/features/strategy";
import type { AllocationSlice } from "./types";

const UNCATEGORIZED = "SEM_CATEGORIA";

function withShares(entries: { key: string; label: string; value: number }[]): AllocationSlice[] {
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  return entries
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((entry) => ({ ...entry, share: total > 0 ? entry.value / total : 0 }));
}

export function allocationByCategory(
  rows: readonly { category: Category | null; currentValue: number }[],
): AllocationSlice[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = row.category ?? UNCATEGORIZED;
    totals.set(key, (totals.get(key) ?? 0) + row.currentValue);
  }
  return withShares(
    [...totals].map(([key, value]) => ({
      key,
      label: key === UNCATEGORIZED ? "Sem categoria" : CATEGORY_LABELS[key as Category],
      value,
    })),
  );
}

/** Os `top` maiores ativos e o restante somado em "Outros". */
export function allocationByAsset(
  rows: readonly { ticker: string; currentValue: number }[],
  top = 10,
): AllocationSlice[] {
  const sorted = [...rows].sort((a, b) => b.currentValue - a.currentValue);
  const head = sorted.slice(0, top).map((row) => ({
    key: row.ticker,
    label: row.ticker,
    value: row.currentValue,
  }));
  const rest = sorted.slice(top).reduce((sum, row) => sum + row.currentValue, 0);
  return withShares(rest > 0 ? [...head, { key: "OUTROS", label: "Outros", value: rest }] : head);
}
