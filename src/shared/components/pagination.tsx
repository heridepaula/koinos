"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { NativeSelect } from "@/shared/ui/native-select";

/**
 * Rodapé de tabela paginada: quantos por página à esquerda; à direita, a faixa mostrada e os
 * botões de página, redondos. Em telas estreitas, as duas metades quebram em linhas.
 */
export function Pagination<Size extends number>({
  page,
  pageCount,
  pageSize,
  pageSizes,
  total,
  firstIndex,
  shown,
  itemLabel,
  onPage,
  onPageSize,
}: {
  page: number;
  pageCount: number;
  pageSize: Size;
  pageSizes: readonly Size[];
  total: number;
  firstIndex: number;
  shown: number;
  /** "lançamentos", para o rótulo do select. */
  itemLabel: string;
  onPage: (page: number) => void;
  onPageSize: (size: Size) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-(--card-spacing) pt-4 text-sm text-muted-foreground">
      <label className="flex items-center gap-2">
        Mostrar
        <NativeSelect
          aria-label={`${itemLabel} por página`}
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value) as Size)}
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </NativeSelect>
        por página
      </label>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          {firstIndex + 1}–{firstIndex + shown} de {total}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="tabular-nums">
          Página {page} de {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Próxima página"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
