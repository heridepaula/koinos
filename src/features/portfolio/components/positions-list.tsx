"use client";

import { ChevronRightIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { PriorityBadge } from "@/features/smart-buy/ui";
import { AssetLabel } from "@/shared/components/asset-label";
import { Delta, DeltaChip } from "@/shared/components/delta";
import { InsetGroup, InsetValueRow } from "@/shared/components/inset-list";
import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import {
  createDrawerHandle,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/ui/drawer";
import type { PositionRow } from "../domain/types";

/**
 * Celular: as posições numa lista como a do app Bolsa. Cada célula traz só o essencial (o ativo,
 * o valor atual e o L/P em %); o toque abre a folha com o resto: a posição, a conta do resultado
 * e o método Suno. Uma folha só para a lista inteira, com a linha tocada como carga.
 */
export function PositionsList({ rows }: { rows: PositionRow[] }) {
  const [sheet] = useState(() => createDrawerHandle<PositionRow>());
  return (
    <>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.ticker}>
            <DrawerTrigger
              handle={sheet}
              payload={row}
              className="flex w-full items-center gap-3 px-(--card-spacing) py-3 text-left outline-none select-none [-webkit-touch-callout:none] focus-visible:bg-foreground/5 active:bg-foreground/8"
            >
              <div className="min-w-0 flex-1">
                <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} size="lg" />
              </div>
              <div className="grid justify-items-end gap-0.5">
                <span className="text-headline font-normal tabular-nums">
                  {formatBRL(row.currentValue)}
                </span>
                <Delta pct={row.pnlPct} className="text-footnote" />
              </div>
              <ChevronRightIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </DrawerTrigger>
          </li>
        ))}
      </ul>
      <Drawer handle={sheet}>
        {({ payload }) => (payload ? <PositionSheet row={payload} /> : null)}
      </Drawer>
    </>
  );
}

function PositionSheet({ row }: { row: PositionRow }) {
  const belowCeiling =
    !row.suspiciousCeiling && row.marginToCeiling !== null && row.marginToCeiling > 0;
  return (
    <DrawerContent>
      <DrawerHeader className="justify-items-start pr-16 pl-5 text-left">
        <DrawerTitle>
          <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} size="lg" />
        </DrawerTitle>
      </DrawerHeader>
      <DrawerBody className="grid content-start gap-5">
        <div className="grid justify-items-start gap-2 px-1">
          <p className="text-footnote text-muted-foreground">Valor atual</p>
          <p className="text-title-1 tabular-nums">{formatBRL(row.currentValue)}</p>
          <DeltaChip value={row.pnl} pct={row.pnlPct} />
        </div>
        <InsetGroup title="Posição">
          <InsetValueRow label="Cotas" value={formatQuantity(row.quantity)} />
          <InsetValueRow label="Preço médio" value={formatBRL(row.averagePrice)} />
          <InsetValueRow
            label="Preço atual"
            value={row.price === null ? "—" : formatBRL(row.price)}
          />
          <InsetValueRow label="Investido" value={formatBRL(row.totalCost)} />
          <InsetValueRow label="% da carteira" value={formatPercent(row.portfolioWeight, 1)} />
        </InsetGroup>
        <InsetGroup title="Resultado">
          <InsetValueRow label="Cotação" value={<Delta value={row.pnl} />} />
          <InsetValueRow label="Proventos" value={formatBRL(row.dividends)} />
          <InsetValueRow label="Com proventos" value={<Delta value={row.pnlWithDividends} />} />
          <InsetValueRow label="Vendas" value={<Delta value={row.realizedPnL} />} />
          <InsetValueRow label="Resultado total" value={<Delta value={row.totalResult} />} strong />
        </InsetGroup>
        <InsetGroup
          title="Método Suno"
          footer={
            row.suspiciousCeiling ? (
              <span className="inline-flex items-start gap-1.5">
                <TriangleAlertIcon
                  className="mt-0.5 size-3.5 shrink-0 text-warn"
                  aria-hidden="true"
                />
                Teto muito longe do preço: confira se não há erro de digitação.
              </span>
            ) : null
          }
        >
          <InsetValueRow label="Rank" value={row.sunoRank === null ? "—" : `${row.sunoRank}º`} />
          <InsetValueRow
            label="Preço teto"
            value={
              row.ceilingPrice === null
                ? "—"
                : belowCeiling
                  ? `${formatBRL(row.ceilingPrice)} · ${formatPercent(row.marginToCeiling ?? 0, 1)} abaixo`
                  : formatBRL(row.ceilingPrice)
            }
          />
          <InsetValueRow label="Prioridade" value={<PriorityBadge priority={row.priority} />} />
        </InsetGroup>
      </DrawerBody>
    </DrawerContent>
  );
}
