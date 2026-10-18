"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { SortableHead } from "@/shared/components/sortable-head";
import { useSortState } from "@/shared/hooks/use-sort-state";
import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { sortRows } from "@/shared/lib/sort";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/shared/ui/table";
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

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  const [filters, setFilters] = useQueryStates(
    {
      ativo: parseAsString.withDefault(""),
      tipo: parseAsStringLiteral(TYPES).withDefault("todos"),
      ano: parseAsString.withDefault(""),
    },
    { history: "replace" },
  );
  const { sortKey, direction, toggle } = useSortState(SORT_KEYS, "data", "desc", ["ativo"]);

  const years = [...new Set(rows.map((row) => String(row.date.getUTCFullYear())))].sort().reverse();
  const tickerFilter = filters.ativo.trim().toUpperCase();
  const filtered = rows.filter(
    (row) =>
      (!tickerFilter || row.ticker.includes(tickerFilter)) &&
      (filters.tipo === "todos" || (filters.tipo === "compra") === (row.type === "BUY")) &&
      (!filters.ano || String(row.date.getUTCFullYear()) === filters.ano),
  );
  const sorted = sortRows(filtered, SORT_VALUE[sortKey], direction);

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
            onChange={(event) => void setFilters({ ativo: event.target.value })}
          />
          <select
            aria-label="Filtrar por tipo"
            className={selectClass}
            value={filters.tipo}
            onChange={(event) =>
              void setFilters({ tipo: event.target.value as (typeof TYPES)[number] })
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
            onChange={(event) => void setFilters({ ano: event.target.value })}
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
                onSort={() => toggle("data")}
                className="pl-6"
              >
                Data
              </SortableHead>
              <SortableHead
                active={sortKey === "ativo"}
                direction={direction}
                onSort={() => toggle("ativo")}
              >
                Ativo
              </SortableHead>
              <SortableHead active={false} direction={direction} onSort={() => toggle("data")}>
                Tipo
              </SortableHead>
              <SortableHead
                active={sortKey === "qtd"}
                direction={direction}
                onSort={() => toggle("qtd")}
                align="right"
              >
                Qtd.
              </SortableHead>
              <SortableHead
                active={sortKey === "preco"}
                direction={direction}
                onSort={() => toggle("preco")}
                align="right"
              >
                Preço
              </SortableHead>
              <SortableHead
                active={false}
                direction={direction}
                onSort={() => toggle("total")}
                align="right"
              >
                Taxas
              </SortableHead>
              <SortableHead
                active={sortKey === "total"}
                direction={direction}
                onSort={() => toggle("total")}
                align="right"
              >
                Total
              </SortableHead>
              <SortableHead
                active={false}
                direction={direction}
                onSort={() => toggle("data")}
                className="pr-6 text-right"
              >
                Ações
              </SortableHead>
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
              sorted.map((row) => (
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
                    <Badge variant={row.type === "BUY" ? "secondary" : "outline"}>
                      {row.type === "BUY" ? "Compra" : "Venda"}
                    </Badge>
                    {row.source === "PLANILHA" ? (
                      <span className="ml-1.5 text-xs text-muted-foreground">planilha</span>
                    ) : null}
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
