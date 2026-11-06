"use client";

import { ChevronRightIcon, Trash2Icon } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { StrategyRow } from "@/features/portfolio";
import { PriorityBadge } from "@/features/smart-buy/ui";
import { AssetLabel } from "@/shared/components/asset-label";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  createDrawerHandle,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/ui/drawer";
import { Switch } from "@/shared/ui/switch";
import { BiasSelect } from "./bias-select";
import { CategorySelect } from "./category-select";
import { CATEGORY_LABELS } from "../../domain/categories";
import { CeilingCheckBody } from "../ceiling-check-body";
import { CeilingCheckIcon } from "../ceiling-check-icon";
import { suggestedPercentProblem } from "../../domain/quarantine";
import { MoneyField } from "./money-field";
import { NumberField } from "./number-field";
import { MarginValue, WeightValue } from "./read-only-cells";
import { useTargetRow } from "./use-target-row";

type SheetHandle = ReturnType<typeof createDrawerHandle<string>>;

/**
 * Celular: a tabela editável de 12 colunas vira uma lista, como os Ajustes do iOS, em duas
 * seções: os ativos da estratégia (o resumo, o selo "Aguardar" e, quando entram no aporte, a
 * posição na fila) e os que estão fora. O toque abre a folha de edição. Uma folha só para a
 * lista, com o ticker como carga: ela lê a linha atual a cada salvamento, e não uma cópia do
 * momento do toque. FIIs e ações usam a mesma lista; `stock` só deixa a Categoria da folha fixa.
 */
export function StrategyList({ rows, stock = false }: { rows: StrategyRow[]; stock?: boolean }) {
  const [sheet] = useState(() => createDrawerHandle<string>());
  const members = rows.filter((row) => row.inStrategy);
  const others = rows.filter((row) => !row.inStrategy);
  return (
    <>
      <RowList rows={members} sheet={sheet} />
      {others.length > 0 ? (
        <>
          <h3 className="border-t px-(--card-spacing) pt-6 pb-2 text-footnote font-medium text-muted-foreground">
            Fora da estratégia
          </h3>
          <RowList rows={others} sheet={sheet} />
        </>
      ) : null}
      <Drawer handle={sheet}>
        {({ payload }) => {
          const row = rows.find((item) => item.ticker === payload);
          return row ? (
            <StrategySheet row={row} stock={stock} onRemoved={() => sheet.close()} />
          ) : null;
        }}
      </Drawer>
    </>
  );
}

function RowList({ rows, sheet }: { rows: StrategyRow[]; sheet: SheetHandle }) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.ticker}>
          <DrawerTrigger
            handle={sheet}
            payload={row.ticker}
            className={cn(
              "flex w-full items-center gap-3 px-(--card-spacing) py-3 text-left outline-none select-none [-webkit-touch-callout:none] focus-visible:bg-foreground/5 active:bg-foreground/8",
              !row.inStrategy && "text-muted-foreground",
            )}
          >
            <div className="grid min-w-0 flex-1 gap-1">
              <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
              {row.inStrategy ? (
                <span className="text-footnote text-muted-foreground tabular-nums">
                  {summary(row)}
                  {row.ceilingCheck && row.ceilingPrice !== null ? (
                    <span className="ml-1.5 inline-flex align-middle">
                      <CeilingCheckIcon
                        check={row.ceilingCheck}
                        ceiling={row.ceilingPrice}
                        price={row.price}
                        tooltip={false}
                      />
                    </span>
                  ) : null}
                  {row.bias === "AGUARDAR" ? (
                    <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-caption">
                      Aguardar
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
            {row.inStrategy ? <PriorityBadge priority={row.priority} quiet /> : null}
            <ChevronRightIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </DrawerTrigger>
        </li>
      ))}
    </ul>
  );
}

const summary = (row: StrategyRow) =>
  [
    row.rank === null ? null : `${row.rank}º`,
    row.ceilingPrice === null ? "sem teto" : `teto ${formatBRL(row.ceilingPrice)}`,
    row.suggestedPercent === null ? null : formatPercent(row.suggestedPercent / 100, 1),
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * A folha de edição: os campos em grupos, como os Ajustes (rótulo à esquerda, controle à
 * direita), o que é calculado num grupo à parte e o Remover no fim, em vermelho. Os campos salvam
 * ao sair, como na tabela.
 */
function StrategySheet({
  row,
  stock,
  onRemoved,
}: {
  row: StrategyRow;
  stock: boolean;
  onRemoved: () => void;
}) {
  const { save, remove, removing } = useTargetRow(row.ticker, { onRemoved });
  return (
    <DrawerContent>
      <DrawerHeader className="justify-items-start pr-16 pl-5 text-left">
        <DrawerTitle>
          <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} size="lg" />
        </DrawerTitle>
        <DrawerDescription>Os campos salvam ao sair.</DrawerDescription>
      </DrawerHeader>
      <DrawerBody className="grid content-start gap-4">
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
              value={row.rank}
              onCommit={(value) => save({ rank: value })}
            />
          </SheetRow>
          <SheetRow label="Preço teto (R$)">
            <div className="flex items-center gap-2">
              {/* Só o ícone: o texto do aviso aparece no bloco abaixo, porque o toque não abre tooltip. */}
              {row.ceilingCheck && row.ceilingPrice !== null ? (
                <CeilingCheckIcon
                  check={row.ceilingCheck}
                  ceiling={row.ceilingPrice}
                  price={row.price}
                  tooltip={false}
                />
              ) : null}
              <MoneyField
                label="Preço teto"
                className="w-36 bg-card dark:bg-card"
                value={row.ceilingPrice}
                onCommit={(value) => save({ ceilingPrice: value })}
              />
            </div>
          </SheetRow>
          <SheetRow label="% sugerida">
            <NumberField
              label="% sugerida"
              className="w-24 bg-card dark:bg-card"
              value={row.suggestedPercent}
              validate={(value) => suggestedPercentProblem(value, row.inStrategy)}
              onCommit={(value) => save({ suggestedPercent: value })}
            />
          </SheetRow>
          <SheetRow label="Categoria">
            {stock ? (
              CATEGORY_LABELS.ACAO
            ) : (
              <CategorySelect
                row={row}
                quiet="sheet"
                className="w-44"
                onChange={(category) => save({ category })}
              />
            )}
          </SheetRow>
          <SheetRow label="Viés">
            <BiasSelect
              row={row}
              quiet="sheet"
              className="w-44"
              onChange={(bias) => save({ bias })}
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
        {row.ceilingCheck && row.ceilingPrice !== null ? (
          <div className="rounded-2xl bg-secondary/60 px-4 py-3 text-footnote">
            <CeilingCheckBody
              check={row.ceilingCheck}
              ceiling={row.ceilingPrice}
              price={row.price}
            />
          </div>
        ) : null}
        {row.configured ? (
          <Button variant="destructive" className="h-12" disabled={removing} onClick={remove}>
            <Trash2Icon />
            Remover da Carteira Alvo
          </Button>
        ) : null}
      </DrawerBody>
    </DrawerContent>
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
