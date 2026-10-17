export type SortDirection = "asc" | "desc";

/** Ordena uma cópia das linhas. Valores nulos ficam sempre no fim. */
export function sortRows<T>(
  rows: readonly T[],
  value: (row: T) => number | string | null | undefined,
  direction: SortDirection,
): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
    return String(left).localeCompare(String(right), "pt-BR") * factor;
  });
}
