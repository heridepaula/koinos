export const PAGE_SIZES = [10, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 10;

export type PageSlice<T> = {
  /** As linhas da página corrigida. Cópia: a entrada não muda. */
  rows: T[];
  /** A página corrigida, de 1 a pageCount. */
  page: number;
  /** Ao menos 1, mesmo sem linhas. */
  pageCount: number;
  /** Índice (base 0) da primeira linha da página na lista inteira. */
  firstIndex: number;
  total: number;
};

export function paginate<T>(rows: readonly T[], page: number, pageSize: number): PageSlice<T> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError(`pageSize inválido: ${pageSize}`);
  }
  const requested = Number.isFinite(page) ? Math.trunc(page) : 1;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const corrected = Math.min(Math.max(1, requested), pageCount);
  const firstIndex = (corrected - 1) * pageSize;
  return {
    rows: rows.slice(firstIndex, firstIndex + pageSize),
    page: corrected,
    pageCount,
    firstIndex,
    total: rows.length,
  };
}
