"use client";

import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Pagination } from "@/shared/components/pagination";
import { SortableHead } from "@/shared/components/sortable-head";
import { usePagedRows } from "@/shared/hooks/use-paged-rows";
import { useSortState } from "@/shared/hooks/use-sort-state";
import { CLASS_PARAMS, inClass, parseClassParam } from "@/shared/lib/class-filter";
import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { sortRows } from "@/shared/lib/sort";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { TransactionActions } from "./table/transaction-actions";
import { TransactionFilters, TYPES } from "./table/transaction-filters";
import { TransactionType } from "./table/transaction-type";
import { TransactionsList } from "./table/transactions-list";
import type { TransactionRow } from "./types";
import { QUANTITY_MASK, Sensitive } from "@/shared/components/sensitive";

const SORT_KEYS = ["data", "ativo", "qtd", "preco", "total"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const total = (row: TransactionRow) =>
  row.quantity * row.unitPrice + (row.type === "BUY" ? row.fees : -row.fees);
const SORT_VALUE: Record<SortKey, (row: TransactionRow) => number | string> = {
  data: (row) => row.date.getTime(),
  ativo: (row) => row.ticker,
  qtd: (row) => row.quantity,
  preco: (row) => row.unitPrice,
  total,
};

/**
 * Lançamentos com filtros, ordenação e páginas (tudo na URL). A partir de 640 px de card é uma
 * tabela; abaixo disso, a lista de células do celular, sem páginas. O "Novo lançamento" fica no
 * cabeçalho da página (no iPhone, no botão ao lado da tab bar).
 */
export function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  const [filters, setFilters] = useQueryStates(
    {
      ativo: parseAsString.withDefault(""),
      tipo: parseAsStringLiteral(TYPES).withDefault("todos"),
      ano: parseAsString.withDefault(""),
      classe: parseAsStringLiteral(CLASS_PARAMS),
    },
    { history: "replace" },
  );
  const { sortKey, direction, toggle } = useSortState(SORT_KEYS, "data", "desc", ["ativo"]);

  const classFilter = parseClassParam(filters.classe);
  const years = [...new Set(rows.map((row) => String(row.date.getUTCFullYear())))].sort().reverse();
  const tickerFilter = filters.ativo.trim().toUpperCase();
  const filtered = rows.filter(
    (row) =>
      inClass(classFilter, row.assetClass) &&
      (!tickerFilter || row.ticker.includes(tickerFilter)) &&
      (filters.tipo === "todos" || (filters.tipo === "compra") === (row.type === "BUY")) &&
      (!filters.ano || String(row.date.getUTCFullYear()) === filters.ano),
  );
  const sorted = sortRows(filtered, SORT_VALUE[sortKey], direction);
  const { rows: pageRows, pagination, resetPage } = usePagedRows(sorted);
  const sortBy = (key: SortKey) => {
    toggle(key);
    resetPage();
  };

  return (
    <Card className="@container">
      <CardHeader className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="grid gap-1">
          {/* No celular, o título grande da página já diz o que é: fica só a contagem. */}
          <CardTitle className="hidden @min-[640px]:block">Lançamentos</CardTitle>
          <CardDescription>
            {filtered.length === rows.length
              ? `${rows.length} lançamentos`
              : `${filtered.length} de ${rows.length} lançamentos`}
          </CardDescription>
        </div>
        <TransactionFilters
          ticker={filters.ativo}
          type={filters.tipo}
          year={filters.ano}
          years={years}
          resultCount={filtered.length}
          onChange={(patch) => {
            void setFilters(patch);
            resetPage();
          }}
        />
      </CardHeader>
      <CardContent className="px-0">
        {sorted.length === 0 ? (
          <p className="px-(--card-spacing) py-10 text-center text-muted-foreground">
            Nenhum lançamento com esses filtros.
          </p>
        ) : (
          <>
            {/* A lista do celular rola sem páginas ("Mostrar mais"); volta ao começo a cada filtro. */}
            <div className="@min-[640px]:hidden">
              <TransactionsList
                key={`${classFilter}|${tickerFilter}|${filters.tipo}|${filters.ano}|${sortKey}|${direction}`}
                rows={sorted}
                total={total}
              />
            </div>
            <Table className="hidden @min-[640px]:table">
              <TableHeader>
                <TableRow>
                  <SortableHead
                    active={sortKey === "data"}
                    direction={direction}
                    onSort={() => sortBy("data")}
                    className="pl-(--card-spacing)"
                  >
                    Data
                  </SortableHead>
                  <SortableHead
                    active={sortKey === "ativo"}
                    direction={direction}
                    onSort={() => sortBy("ativo")}
                  >
                    Ativo
                  </SortableHead>
                  <TableHead>Tipo</TableHead>
                  <SortableHead
                    active={sortKey === "qtd"}
                    direction={direction}
                    onSort={() => sortBy("qtd")}
                    align="right"
                  >
                    Qtd.
                  </SortableHead>
                  <SortableHead
                    active={sortKey === "preco"}
                    direction={direction}
                    onSort={() => sortBy("preco")}
                    align="right"
                  >
                    Preço
                  </SortableHead>
                  <TableHead className="text-right">Taxas</TableHead>
                  <SortableHead
                    active={sortKey === "total"}
                    direction={direction}
                    onSort={() => sortBy("total")}
                    align="right"
                  >
                    Total
                  </SortableHead>
                  <TableHead className="pr-(--card-spacing) text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-(--card-spacing) tabular-nums">
                      {formatTradeDate(row.date)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.ticker}
                      {row.notes ? (
                        <span className="block max-w-56 truncate text-caption font-normal text-muted-foreground">
                          {row.notes}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <TransactionType row={row} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Sensitive mask={QUANTITY_MASK}>{formatQuantity(row.quantity)}</Sensitive>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(row.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Sensitive>{formatBRL(row.fees)}</Sensitive>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      <Sensitive>{formatBRL(total(row))}</Sensitive>
                    </TableCell>
                    <TableCell className="pr-(--card-spacing) text-right">
                      <TransactionActions row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="hidden @min-[640px]:block">
              <Pagination {...pagination} itemLabel="Lançamentos" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
