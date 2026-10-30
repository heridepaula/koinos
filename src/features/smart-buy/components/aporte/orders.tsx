"use client";

import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { AssetLabel } from "@/shared/components/asset-label";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { CascadeOrder } from "../../domain/suno-cascade";
import { explain, shortReason } from "./explain";

export type AssetMeta = { ticker: string; name: string | null; logoUrl: string | null };

type OrdersProps = {
  orders: CascadeOrder[];
  meta: ReadonlyMap<string, AssetMeta>;
};

/**
 * Tabela das ordens (a partir de 760 px de card). O porquê é um comentário curto e discreto; a
 * conta inteira (cada tensor, o pedido e a trava) fica na dica ao passar o mouse.
 */
export function OrdersTable({ orders, meta }: OrdersProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-(--card-spacing)">Ativo</TableHead>
          <TableHead className="text-right">Cotas</TableHead>
          <TableHead className="text-right">Preço</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">% antes → depois</TableHead>
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
                {formatQuantity(order.quantity)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(order.price)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatBRL(order.total)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(order.weightBefore, 1)} → {formatPercent(order.weightAfter, 1)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(order.targetWeight, 1)}
              </TableCell>
              <TableCell
                className="min-w-48 pr-(--card-spacing) text-caption whitespace-normal text-muted-foreground"
                title={capitalize(explain(order).join(" · "))}
              >
                {shortReason(order)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/**
 * Celular: cada ordem numa célula, como uma tabela do iOS: o ativo e o total; as cotas × preço e o
 * peso antes → depois; e, discreto, o porquê em poucas palavras. A conta inteira abre numa folha
 * ao tocar, com o chevron dizendo que há mais.
 */
export function OrdersList({ orders, meta }: OrdersProps) {
  const [sheet] = useState(() => createDrawerHandle<CascadeOrder>());
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
                      {formatBRL(order.total)}
                    </span>
                  </div>
                  <p className="flex justify-between gap-3 text-footnote text-muted-foreground tabular-nums">
                    <span>
                      {formatQuantity(order.quantity)} {order.quantity === 1 ? "cota" : "cotas"} ×{" "}
                      {formatBRL(order.price)}
                    </span>
                    <span className="whitespace-nowrap">
                      {formatPercent(order.weightBefore, 1)} → {formatPercent(order.weightAfter, 1)}
                    </span>
                  </p>
                  <p className="text-caption text-muted-foreground">{shortReason(order)}</p>
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
          payload ? <OrderSheet order={payload} info={meta.get(payload.ticker)} /> : null
        }
      </Drawer>
    </>
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function OrderSheet({ order, info }: { order: CascadeOrder; info: AssetMeta | undefined }) {
  return (
    <DrawerContent>
      <DrawerHeader className="justify-items-start pr-16 pl-5 text-left">
        <DrawerTitle>
          <AssetLabel ticker={order.ticker} name={info?.name} logoUrl={info?.logoUrl} size="lg" />
        </DrawerTitle>
      </DrawerHeader>
      <DrawerBody className="grid content-start gap-5">
        <div className="grid justify-items-start gap-1 px-1">
          <p className="text-footnote text-muted-foreground">Comprar</p>
          <p className="text-title-1 tabular-nums">{formatBRL(order.total)}</p>
          <p className="text-subheadline text-muted-foreground tabular-nums">
            {formatQuantity(order.quantity)} {order.quantity === 1 ? "cota" : "cotas"} × ~
            {formatBRL(order.price)}
          </p>
        </div>
        <InsetGroup title="Peso na carteira">
          <InsetValueRow label="Antes" value={formatPercent(order.weightBefore, 1)} />
          <InsetValueRow label="Depois" value={formatPercent(order.weightAfter, 1)} />
          <InsetValueRow label="Meta" value={formatPercent(order.targetWeight, 1)} />
        </InsetGroup>
        <InsetGroup title="Por quê">
          {explain(order).map((reason) => (
            <div key={reason} className="flex min-h-11 items-center px-4 py-2 text-subheadline">
              {capitalize(reason)}
            </div>
          ))}
        </InsetGroup>
      </DrawerBody>
    </DrawerContent>
  );
}
