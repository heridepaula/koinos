import { CATEGORY_LABELS, type Category } from "@/features/strategy";
import type { AllocationSlice } from "./types";

/** Pizza só para parte-do-todo "de relance": no máximo 6 fatias (5 maiores + "Outros"). */
export const MAX_SLICES = 6;
export const OTHERS_KEY = "OUTROS";
export const UNCATEGORIZED_KEY = "SEM_CATEGORIA";

function toSlices(entries: { key: string; label: string; value: number }[]): AllocationSlice[] {
  const positive = entries.filter((entry) => entry.value > 0).sort((a, b) => b.value - a.value);
  const head = positive.length > MAX_SLICES ? positive.slice(0, MAX_SLICES - 1) : positive;
  const rest = positive.slice(head.length).reduce((sum, entry) => sum + entry.value, 0);
  const all = rest > 0 ? [...head, { key: OTHERS_KEY, label: "Outros", value: rest }] : head;
  const total = all.reduce((sum, entry) => sum + entry.value, 0);
  return all.map((entry) => ({ ...entry, share: total > 0 ? entry.value / total : 0 }));
}

export function allocationByCategory(
  rows: readonly { category: Category | null; currentValue: number }[],
): AllocationSlice[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = row.category ?? UNCATEGORIZED_KEY;
    totals.set(key, (totals.get(key) ?? 0) + row.currentValue);
  }
  return toSlices(
    [...totals].map(([key, value]) => ({
      key,
      label: key === UNCATEGORIZED_KEY ? "Sem categoria" : CATEGORY_LABELS[key as Category],
      value,
    })),
  );
}

export function allocationByAsset(
  rows: readonly { ticker: string; currentValue: number }[],
): AllocationSlice[] {
  return toSlices(
    rows.map((row) => ({ key: row.ticker, label: row.ticker, value: row.currentValue })),
  );
}
