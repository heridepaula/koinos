"use client";

import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import { PriorityBadge } from "@/features/smart-buy/ui";
import { AssetLabel } from "@/shared/components/asset-label";
import { Delta } from "@/shared/components/delta";
import { SortableHead } from "@/shared/components/sortable-head";
import { useSortState } from "@/shared/hooks/use-sort-state";
import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import { sortRows } from "@/shared/lib/sort";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { NativeSelect } from "@/shared/ui/native-select";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/shared/ui/popover";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/shared/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import type { PositionRow } from "../domain/types";
import { PositionsList } from "./positions-list";

const SORT_KEYS = [
  "ativo",
  "rank",
  "qtd",
  "preco",
  "pm",
  "teto",
  "valor",
  "investido",
  "lp",
  "ajustado",
  "peso",
  "prioridade",
] as const;
type SortKey = (typeof SORT_KEYS)[number];

const SORT_VALUE: Record<SortKey, (row: PositionRow) => number | string | null> = {
  ativo: (row) => row.ticker,
  rank: (row) => row.sunoRank,
  qtd: (row) => row.quantity,
  preco: (row) => row.price,
  pm: (row) => row.averagePrice,
  teto: (row) => row.ceilingPrice,
  valor: (row) => row.currentValue,
  investido: (row) => row.totalCost,
  lp: (row) => row.pnl,
  ajustado: (row) => row.pnlWithDividends,
  peso: (row) => row.portfolioWeight,
  prioridade: (row) =>
    row.priority?.kind === "fila" ? row.priority.position : row.priority ? 1000 : null,
};

const COLUMNS: { key: SortKey; label: string; align?: "right"; title?: string }[] = [
  { key: "rank", label: "Rank", align: "right" },
  { key: "qtd", label: "Qtd.", align: "right" },
  { key: "preco", label: "Preço atual", align: "right" },
  { key: "pm", label: "Preço médio", align: "right" },
  { key: "teto", label: "Preço teto", align: "right" },
  { key: "valor", label: "Valor atual", align: "right" },
  { key: "investido", label: "Investido", align: "right" },
  { key: "lp", label: "L/P", align: "right" },
  {
    key: "ajustado",
    label: "c/ proventos",
    align: "right",
    title: "Resultado com proventos: L/P da cotação + proventos recebidos",
  },
  { key: "peso", label: "% carteira", align: "right" },
];

function CeilingCell({ row }: { row: PositionRow }) {
  if (row.ceilingPrice === null) return <span className="text-muted-foreground">—</span>;
  // Com teto suspeito, "abaixo do teto" não é confiável: mostra só o aviso.
  const belowCeiling =
    !row.suspiciousCeiling && row.marginToCeiling !== null && row.marginToCeiling > 0;
  return (
    <div className="flex items-center justify-end gap-1.5">
      {row.suspiciousCeiling ? (
        <Tooltip>
          <TooltipTrigger render={<span />}>
            <TriangleAlertIcon
              className="size-3.5 text-amber-600 dark:text-amber-400"
              aria-label="Teto suspeito"
            />
          </TooltipTrigger>
          <TooltipContent>
            Teto muito longe do preço: confira se não há erro de digitação.
          </TooltipContent>
        </Tooltip>
      ) : null}
      {belowCeiling ? (
        <Tooltip>
          <TooltipTrigger render={<span />}>
            <CircleCheckIcon className="size-3.5 text-gain" aria-label="Abaixo do teto" />
          </TooltipTrigger>
          <TooltipContent>
            Abaixo do teto: margem de {formatPercent(row.marginToCeiling ?? 0, 1)}.
          </TooltipContent>
        </Tooltip>
      ) : null}
      <span className="tabular-nums">{formatBRL(row.ceilingPrice)}</span>
    </div>
  );
}

/**
 * Resultado com proventos, empilhado como o L/P: o valor em cima e os proventos embaixo.
 * É um botão que abre a conta até o resultado total: por clique ou toque, por teclado (Enter ou
 * Espaço) e ao passar o mouse. É o único lugar que mostra as vendas e o total de cada posição.
 */
function AdjustedCell({ row }: { row: PositionRow }) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        openOnHover
        delay={200}
        closeDelay={100}
        aria-label={`Ver a conta do resultado de ${row.ticker}: ${formatBRL(row.pnlWithDividends)} com proventos`}
        className="inline-flex cursor-pointer flex-col items-end rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Delta value={row.pnlWithDividends} />
        <span className="text-xs text-muted-foreground tabular-nums">
          prov. {formatBRL(row.dividends)}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto">
        <PopoverTitle className="sr-only">Conta do resultado de {row.ticker}</PopoverTitle>
        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 tabular-nums">
          <dt>Cotação</dt>
          <dd className="text-right">{formatBRL(row.pnl)}</dd>
          <dt>+ Proventos</dt>
          <dd className="text-right">{formatBRL(row.dividends)}</dd>
          <dt>= Com proventos</dt>
          <dd className="text-right">{formatBRL(row.pnlWithDividends)}</dd>
          <dt>+ Vendas</dt>
          <dd className="text-right">{formatBRL(row.realizedPnL)}</dd>
          <dt className="font-medium">= Resultado total</dt>
          <dd className="text-right font-medium">{formatBRL(row.totalResult)}</dd>
        </dl>
      </PopoverContent>
    </Popover>
  );
}

/** As ordens que a lista do celular oferece no seletor (as colunas que mais importam). */
const LIST_SORTS: { key: SortKey; label: string }[] = [
  { key: "valor", label: "Valor" },
  { key: "lp", label: "L/P" },
  { key: "ajustado", label: "L/P + prov." },
  { key: "peso", label: "% carteira" },
  { key: "rank", label: "Rank" },
  { key: "prioridade", label: "Prioridade" },
  { key: "ativo", label: "Ativo" },
];

/**
 * As posições: a tabela de 12 colunas a partir de 900 px de card; abaixo disso (o celular), a
 * lista do app Bolsa, com a ordem num seletor nativo (no iPhone, a roleta do sistema).
 */
export function PositionsTable({ rows }: { rows: PositionRow[] }) {
  const { sortKey, direction, toggle, choose } = useSortState(SORT_KEYS, "valor", "desc", [
    "ativo",
    "rank",
    "prioridade",
  ]);
  const sorted = sortRows(rows, SORT_VALUE[sortKey], direction);

  return (
    <Card className="@container">
      <CardHeader>
        <CardTitle>Posições</CardTitle>
        <CardDescription className="hidden @min-[900px]:block">
          Preço médio pelo método da Receita. Clique no título de uma coluna para ordenar.
        </CardDescription>
        <CardAction className="@min-[900px]:hidden">
          <NativeSelect
            aria-label="Ordenar as posições por"
            value={LIST_SORTS.some((sort) => sort.key === sortKey) ? sortKey : "valor"}
            onChange={(event) => choose(event.target.value as SortKey)}
            className="h-9 border-transparent bg-secondary dark:bg-secondary pointer-coarse:h-9"
          >
            {LIST_SORTS.map((sort) => (
              <option key={sort.key} value={sort.key}>
                {sort.label}
              </option>
            ))}
          </NativeSelect>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <div className="@min-[900px]:hidden">
          <PositionsList rows={sorted} />
        </div>
        {/* Colunas do meio mais coladas (px-1) só nesta tabela: com os proventos são 12 colunas e,
            com a sidebar aberta, em 1440 px elas só cabem sem rolagem com o espaçamento reduzido. */}
        <Table className="hidden @min-[900px]:table [&_td:not(:first-child):not(:last-child)]:px-1 [&_th:not(:first-child):not(:last-child)]:px-1">
          <TableHeader>
            <TableRow>
              <SortableHead
                active={sortKey === "ativo"}
                direction={direction}
                onSort={() => toggle("ativo")}
                className="sticky left-0 z-10 bg-card pl-(--card-spacing)"
              >
                Ativo
              </SortableHead>
              {COLUMNS.map((column) => (
                <SortableHead
                  key={column.key}
                  active={sortKey === column.key}
                  direction={direction}
                  onSort={() => toggle(column.key)}
                  align={column.align}
                  title={column.title}
                >
                  {column.label}
                </SortableHead>
              ))}
              <SortableHead
                active={sortKey === "prioridade"}
                direction={direction}
                onSort={() => toggle("prioridade")}
                className="pr-(--card-spacing)"
                title="Prioridade de aporte pelo método Suno"
              >
                Prioridade
              </SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.ticker}>
                <TableCell className="sticky left-0 z-10 bg-card pl-(--card-spacing)">
                  <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.sunoRank === null ? "—" : `${row.sunoRank}º`}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQuantity(row.quantity)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.price === null ? "—" : formatBRL(row.price)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(row.averagePrice)}
                </TableCell>
                <TableCell className="text-right">
                  <CeilingCell row={row} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(row.currentValue)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(row.totalCost)}
                </TableCell>
                <TableCell className="text-right">
                  <Delta value={row.pnl} pct={row.pnlPct} stacked />
                </TableCell>
                <TableCell className="text-right">
                  <AdjustedCell row={row} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPercent(row.portfolioWeight, 1)}
                </TableCell>
                <TableCell className="pr-(--card-spacing)">
                  <PriorityBadge priority={row.priority} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
