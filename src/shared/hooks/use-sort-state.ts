"use client";

import { parseAsStringLiteral, useQueryStates } from "nuqs";
import type { SortDirection } from "@/shared/lib/sort";

const DIRECTIONS = ["asc", "desc"] as const;

/** Ordenação de tabela guardada na URL (?ordem=...&dir=...), para compartilhar e voltar. */
export function useSortState<const K extends string>(
  keys: readonly K[],
  defaultKey: K,
  defaultDirection: SortDirection,
  ascendingByDefault: readonly K[] = [],
) {
  const [{ ordem, dir }, setSort] = useQueryStates(
    {
      ordem: parseAsStringLiteral(keys).withDefault(defaultKey),
      dir: parseAsStringLiteral(DIRECTIONS).withDefault(defaultDirection),
    },
    { history: "replace" },
  );

  const defaultDirectionOf = (key: K) => (ascendingByDefault.includes(key) ? "asc" : "desc");

  function toggle(key: K) {
    if (key === ordem) {
      void setSort({ dir: dir === "asc" ? "desc" : "asc" });
    } else {
      void setSort({ ordem: key, dir: defaultDirectionOf(key) });
    }
  }

  /** Escolhe a coluna na direção padrão dela (o seletor de ordem das listas do celular). */
  function choose(key: K) {
    void setSort({ ordem: key, dir: defaultDirectionOf(key) });
  }

  return { sortKey: ordem as K, direction: dir as SortDirection, toggle, choose };
}
