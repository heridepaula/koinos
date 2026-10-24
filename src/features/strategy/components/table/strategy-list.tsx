"use client";

import { ChevronRightIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import type { StrategyRow } from "@/features/portfolio";
import { PriorityBadge } from "@/features/smart-buy/ui";
import { AssetLabel } from "@/shared/components/asset-label";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";
import { Switch } from "@/shared/ui/switch";
import { CategorySelect } from "./category-select";
import { NumberField } from "./number-field";
import { MarginValue, WeightValue } from "./read-only-cells";
import { useTargetRow } from "./use-target-row";

/**
 * Celular: a tabela editável de 11 colunas vira uma lista, como os Ajustes do iOS. Cada célula
 * mostra o ativo, o resumo (rank, teto, % sugerida) e a prioridade; o toque abre a folha de edição.
 */
export function StrategyList({ rows }: { rows: StrategyRow[] }) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.ticker}>
          <StrategySheet row={row} />
        </li>
      ))}
    </ul>
  );
}

const summary = (row: StrategyRow) =>
  [
    row.sunoRank === null ? null : `${row.sunoRank}º`,
    row.ceilingPrice === null ? "sem teto" : `teto ${formatBRL(row.ceilingPrice)}`,
    row.suggestedPercent === null ? null : formatPercent(row.suggestedPercent / 100, 1),
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * A célula (gatilho) e a folha de baixo com os campos em grupos, como os Ajustes: rótulo à
 * esquerda, controle à direita. Os campos salvam ao sair, como na tabela.
 */
function StrategySheet({ row }: { row: StrategyRow }) {
  const { save, remove, removing } = useTargetRow(row.ticker);
  return (
    <Sheet>
      <SheetTrigger
        className={cn(
          "flex w-full items-center gap-3 px-(--card-spacing) py-3 text-left outline-none focus-visible:bg-muted/60 active:bg-muted/60",
          !row.inStrategy && "text-muted-foreground",
        )}
      >
        <div className="grid min-w-0 flex-1 gap-1">
          <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
          <span className="pl-8 text-footnote text-muted-foreground tabular-nums">
            {row.inStrategy ? summary(row) : "Fora da estratégia"}
          </span>
        </div>
        {row.inStrategy ? <PriorityBadge priority={row.priority} /> : null}
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85svh] gap-4 overflow-y-auto p-5 pb-8">
        <SheetHeader className="p-0">
          <SheetTitle>
            <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
          </SheetTitle>
          <SheetDescription>Os campos salvam ao sair.</SheetDescription>
        </SheetHeader>
        <SheetGroup>
          <SheetRow label="Na estratégia">
            <Switch
              aria-label={`${row.ticker} na estratégia`}
              checked={row.inStrategy}
              onCheckedChange={(checked) => save({ inStrategy: checked })}
            />
          </SheetRow>
          <SheetRow label="Rank">
            <NumberField
              label="Rank"
              integer
              className="w-24 bg-card dark:bg-card"
              value={row.sunoRank}
              onCommit={(value) => save({ sunoRank: value })}
            />
          </SheetRow>
          <SheetRow label="Preço teto (R$)">
            <NumberField
              label="Preço teto"
              className="w-28 bg-card dark:bg-card"
              value={row.ceilingPrice}
              onCommit={(value) => save({ ceilingPrice: value })}
            />
          </SheetRow>
          <SheetRow label="% sugerida">
            <NumberField
              label="% sugerida"
              className="w-24 bg-card dark:bg-card"
              value={row.suggestedPercent}
              onCommit={(value) => save({ suggestedPercent: value })}
            />
          </SheetRow>
          <SheetRow label="Categoria">
            <CategorySelect
              row={row}
              quiet="sheet"
              className="w-44"
              onChange={(category) => save({ category })}
            />
          </SheetRow>
        </SheetGroup>
        <SheetGroup>
          <SheetRow label="Preço atual">{row.price === null ? "—" : formatBRL(row.price)}</SheetRow>
          <SheetRow label="Margem até o teto">
            <MarginValue row={row} />
          </SheetRow>
          <SheetRow label="Peso / meta">
            <WeightValue row={row} />
          </SheetRow>
          <SheetRow label="Prioridade">
            <PriorityBadge priority={row.priority} />
          </SheetRow>
        </SheetGroup>
        {row.configured ? (
          <Button variant="destructive" disabled={removing} onClick={remove}>
            <Trash2Icon />
            Remover da Carteira Alvo
          </Button>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** Grupo de linhas sobre um preenchimento leve, como as seções agrupadas do iOS. */
function SheetGroup({ children }: { children: ReactNode }) {
  return (
    <dl className="grid divide-y divide-border rounded-2xl bg-secondary/60 px-4 text-sm">
      {children}
    </dl>
  );
}

function SheetRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  );
}
