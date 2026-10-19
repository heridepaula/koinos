"use client";

import { ChevronLeftIcon, ChevronRightIcon, LockIcon, PencilIcon, PlusIcon } from "lucide-react";
import {
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { SortableHead } from "@/shared/components/sortable-head";
import { useSortState } from "@/shared/hooks/use-sort-state";
import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { sortRows } from "@/shared/lib/sort";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import type { TransactionKind } from "../domain/types";
import { DeleteTransactionButton } from "./delete-transaction-button";
import { TransactionDialog } from "./transaction-dialog";
import type { TransactionRow } from "./types";

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
const TYPES = ["todos", "compra", "venda"] as const;
const PAGE_SIZES = [10, 50, 100] as const;

const KIND_LABELS: Record<Exclude<TransactionKind, "NEGOCIO">, string> = {
  SUBSCRICAO: "Subscrição",
  DESDOBRO: "Desdobro",
  INCORPORACAO: "Incorporação",
  FRACAO: "Leilão de fração",
  POSICAO_ANTERIOR: "Posição anterior",
};

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  const [filters, setFilters] = useQueryStates(
    {
      ativo: parseAsString.withDefault(""),
      tipo: parseAsStringLiteral(TYPES).withDefault("todos"),
      ano: parseAsString.withDefault(""),
      pagina: parseAsInteger.withDefault(1),
      por: parseAsNumberLiteral(PAGE_SIZES).withDefault(10),
    },
    { history: "replace" },
  );
  const { sortKey, direction, toggle } = useSortState(SORT_KEYS, "data", "desc", ["ativo"]);
  const sortBy = (key: SortKey) => {
    toggle(key);
    void setFilters({ pagina: 1 });
  };

  const years = [...new Set(rows.map((row) => String(row.date.getUTCFullYear())))].sort().reverse();
  const tickerFilter = filters.ativo.trim().toUpperCase();
  const filtered = rows.filter(
    (row) =>
      (!tickerFilter || row.ticker.includes(tickerFilter)) &&
      (filters.tipo === "todos" || (filters.tipo === "compra") === (row.type === "BUY")) &&
      (!filters.ano || String(row.date.getUTCFullYear()) === filters.ano),
  );
  const sorted = sortRows(filtered, SORT_VALUE[sortKey], direction);
  const pageCount = Math.max(1, Math.ceil(sorted.length / filters.por));
  // Uma página fora da faixa (ex.: depois de filtrar) volta para a última que existe.
  const page = Math.min(Math.max(1, filters.pagina), pageCount);
  const firstIndex = (page - 1) * filters.por;
  const pageRows = sorted.slice(firstIndex, firstIndex + filters.por);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Lançamentos</CardTitle>
          <CardDescription>
            {filtered.length} de {rows.length} lançamentos
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Filtrar por ativo"
            placeholder="Ativo"
            className="w-28"
            value={filters.ativo}
            onChange={(event) => void setFilters({ ativo: event.target.value, pagina: 1 })}
          />
          <select
            aria-label="Filtrar por tipo"
            className={selectClass}
            value={filters.tipo}
            onChange={(event) =>
              void setFilters({ tipo: event.target.value as (typeof TYPES)[number], pagina: 1 })
            }
          >
            <option value="todos">Compras e vendas</option>
            <option value="compra">Só compras</option>
            <option value="venda">Só vendas</option>
          </select>
          <select
            aria-label="Filtrar por ano"
            className={selectClass}
            value={filters.ano}
            onChange={(event) => void setFilters({ ano: event.target.value, pagina: 1 })}
          >
            <option value="">Todos os anos</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <TransactionDialog
            trigger={
              <Button>
                <PlusIcon />
                Novo lançamento
              </Button>
            }
          />
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                active={sortKey === "data"}
                direction={direction}
                onSort={() => sortBy("data")}
                className="pl-6"
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
              <TableHead className="pr-6 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Nenhum lançamento com esses filtros.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="pl-6 tabular-nums">{formatTradeDate(row.date)}</TableCell>
                  <TableCell className="font-medium">
                    {row.ticker}
                    {row.notes ? (
                      <span className="block max-w-56 truncate text-xs font-normal text-muted-foreground">
                        {row.notes}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={row.type === "BUY" ? "secondary" : "outline"}>
                        {row.type === "BUY" ? "Compra" : "Venda"}
                      </Badge>
                      {row.kind !== "NEGOCIO" ? (
                        <span className="text-xs">{KIND_LABELS[row.kind]}</span>
                      ) : null}
                      {row.source === "B3" ? (
                        <Badge variant="outline" className="text-[10px]">
                          B3
                        </Badge>
                      ) : row.source === "PLANILHA" ? (
                        <span className="text-xs text-muted-foreground">planilha</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(row.quantity)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(row.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(row.fees)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(total(row))}</TableCell>
                  <TableCell className="pr-6 text-right">
                    {row.source === "B3" ? (
                      // A B3 manda: corrige-se reenviando o extrato, não editando aqui.
                      <Tooltip>
                        <TooltipTrigger render={<span className="inline-flex p-1.5" />}>
                          <LockIcon
                            className="size-3.5 text-muted-foreground"
                            aria-label="Lançamento da B3"
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          Veio do extrato da B3. Para corrigir, envie o extrato de novo.
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <div className="flex justify-end gap-0.5">
                        <TransactionDialog
                          transaction={row}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label="Editar lançamento">
                              <PencilIcon />
                            </Button>
                          }
                        />
                        <DeleteTransactionButton transaction={row} />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {sorted.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-4 text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              Mostrar
              <select
                aria-label="Lançamentos por página"
                className={selectClass}
                value={filters.por}
                onChange={(event) =>
                  void setFilters({
                    por: Number(event.target.value) as (typeof PAGE_SIZES)[number],
                    pagina: 1,
                  })
                }
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              por página
            </label>
            <div className="flex items-center gap-2">
              <span className="tabular-nums">
                {firstIndex + 1}–{firstIndex + pageRows.length} de {sorted.length}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Página anterior"
                disabled={page <= 1}
                onClick={() => void setFilters({ pagina: page - 1 })}
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
                onClick={() => void setFilters({ pagina: page + 1 })}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
