"use client";

import { parseAsInteger, parseAsNumberLiteral, useQueryStates } from "nuqs";
import type { PaginationProps } from "@/shared/components/pagination";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, type PageSize, paginate } from "@/shared/lib/paginate";

export type PageKeys = { page: string; size: string };
export const DEFAULT_PAGE_KEYS: PageKeys = { page: "pagina", size: "por" };

/** Página e tamanho na URL (?pagina=&por=), para compartilhar e voltar. */
export function usePagedRows<T>(
  rows: readonly T[],
  keys: PageKeys = DEFAULT_PAGE_KEYS,
): {
  rows: T[];
  /** Espalhar em <Pagination {...pagination} itemLabel="…" />. */
  pagination: Omit<PaginationProps<PageSize>, "itemLabel" | "className">;
  /** Volta à página 1 (filtro ou ordem mudou). */
  resetPage: () => void;
} {
  const [state, set] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      size: parseAsNumberLiteral(PAGE_SIZES).withDefault(DEFAULT_PAGE_SIZE),
    },
    { history: "replace", urlKeys: { page: keys.page, size: keys.size } },
  );

  const slice = paginate(rows, state.page, state.size);

  return {
    rows: slice.rows,
    pagination: {
      page: slice.page,
      pageCount: slice.pageCount,
      pageSize: state.size,
      pageSizes: PAGE_SIZES,
      total: slice.total,
      firstIndex: slice.firstIndex,
      shown: slice.rows.length,
      onPage: (next) => void set({ page: next }),
      onPageSize: (size) => void set({ size, page: null }),
    },
    resetPage: () => void set({ page: null }),
  };
}
