"use client";

import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { AssetLabel } from "@/shared/components/asset-label";
import { InsetGroup, InsetValueRow } from "@/shared/components/inset-list";
import { QUANTITY_MASK, Sensitive } from "@/shared/components/sensitive";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { StockBuyOrder } from "../../domain/stock-buy";
import { explainStock, shortStockReason } from "./explain";
import type { AssetMeta } from "./orders";

type Props = { orders: StockBuyOrder[]; meta: ReadonlyMap<string, AssetMeta> };

/** Tabela das ordens de ações (a partir de 760 px de card), na ordem da margem de segurança. */
export function StockOrdersTable({ orders, meta }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-(--card-spacing)">Ativo</TableHead>
          <TableHead className="text-right">Ações</TableHead>
          <TableHead className="text-right">Preço</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Margem</TableHead>
          <TableHead className="text-right">% meta</TableHead>
          <TableHead className="pr-(--card-spacing)">Por quê</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const info = meta.get(order.ticker);
          return (
            <TableRow key={order.ticker}>
              <TableCell className="pl-(--card-spacing)">
                <AssetLabel ticker={order.ticker} name={info?.name} logoUrl={info?.logoUrl} />
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                <Sensitive mask={QUANTITY_MASK}>{formatQuantity(order.quantity)}</Sensitive>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(order.price)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                <Sensitive>{formatBRL(order.total)}</Sensitive>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(order.marginOfSafety, 0)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(order.targetWeight, 1)}
              </TableCell>
              <TableCell
                className="min-w-48 pr-(--card-spacing) text-caption whitespace-normal text-muted-foreground"
                title={explainStock(order)}
              >
                {shortStockReason(order)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** Celular: uma célula por ordem; a conta abre numa folha ao tocar. */
export function StockOrdersList({ orders, meta }: Props) {
  const [sheet] = useState(() => createDrawerHandle<StockBuyOrder>());
  return (
    <>
      <ul className="divide-y divide-border">
        {orders.map((order) => {
          const info = meta.get(order.ticker);
          return (
            <li key={order.ticker}>
              <DrawerTrigger
                handle={sheet}
                payload={order}
                className="flex w-full items-center gap-3 px-(--card-spacing) py-3 text-left outline-none select-none [-webkit-touch-callout:none] focus-visible:bg-foreground/5 active:bg-foreground/8"
              >
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <AssetLabel ticker={order.ticker} name={info?.name} logoUrl={info?.logoUrl} />
                    <span className="text-headline whitespace-nowrap tabular-nums">
                      <Sensitive>{formatBRL(order.total)}</Sensitive>
                    </span>
                  </div>
                  <p className="text-footnote text-muted-foreground tabular-nums">
                    <Sensitive mask={QUANTITY_MASK}>{formatQuantity(order.quantity)}</Sensitive>{" "}
                    {order.quantity === 1 ? "ação" : "ações"} × {formatBRL(order.price)}
                  </p>
                  <p className="text-caption text-muted-foreground">{shortStockReason(order)}</p>
                </div>
                <ChevronRightIcon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </DrawerTrigger>
            </li>
          );
        })}
      </ul>
      <Drawer handle={sheet}>
        {({ payload }) =>
          payload ? (
            <DrawerContent>
              <DrawerHeader className="justify-items-start pr-16 pl-5 text-left">
                <DrawerTitle>
                  <AssetLabel
                    ticker={payload.ticker}
                    name={meta.get(payload.ticker)?.name}
                    logoUrl={meta.get(payload.ticker)?.logoUrl}
                    size="lg"
                  />
                </DrawerTitle>
              </DrawerHeader>
              <DrawerBody className="grid content-start gap-5">
                <div className="grid justify-items-start gap-1 px-1">
                  <p className="text-footnote text-muted-foreground">Comprar</p>
                  <p className="text-title-1 tabular-nums">
                    <Sensitive>{formatBRL(payload.total)}</Sensitive>
                  </p>
                  <p className="text-subheadline text-muted-foreground tabular-nums">
                    <Sensitive mask={QUANTITY_MASK}>{formatQuantity(payload.quantity)}</Sensitive>{" "}
                    {payload.quantity === 1 ? "ação" : "ações"} × ~{formatBRL(payload.price)}
                  </p>
                </div>
                <InsetGroup title="Peso na carteira de ações">
                  <InsetValueRow label="Antes" value={formatPercent(payload.weightBefore, 1)} />
                  <InsetValueRow label="Depois" value={formatPercent(payload.weightAfter, 1)} />
                  <InsetValueRow label="Meta" value={formatPercent(payload.targetWeight, 1)} />
                </InsetGroup>
                <InsetGroup title="Por quê">
                  <div className="flex min-h-11 items-center px-4 py-2 text-subheadline">
                    {explainStock(payload)}
                  </div>
                </InsetGroup>
              </DrawerBody>
            </DrawerContent>
          ) : null
        }
      </Drawer>
    </>
  );
}
