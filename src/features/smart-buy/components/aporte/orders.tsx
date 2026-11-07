"use client";

import { ChevronRightIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { CeilingCheck } from "@/features/strategy";
import { CeilingCheckBody, CeilingCheckIcon } from "@/features/strategy/ui";
import { AssetLabel } from "@/shared/components/asset-label";
import { InsetGroup, InsetValueRow } from "@/shared/components/inset-list";
import { QUANTITY_MASK, Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
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
import type { MergedOrder } from "../../domain/merge-orders";
import type { StockBuyOrder } from "../../domain/stock-buy";
import type { CascadeOrder } from "../../domain/fii-cascade";
import {
  explain,
  explainStock,
  shortReason,
  shortStockReason,
  unitOf,
  type OrderKind,
} from "./explain";

export type AssetMeta = {
  ticker: string;
  name: string | null;
  logoUrl: string | null;
  /** O teto do ranking está a mais de 10% do calculado pela NTN-B; só informativo (spec divergencia-teto). */
  ceilingWarning?: { check: CeilingCheck; ceiling: number };
};

type OrdersProps = {
  /** As ordens das carteiras da visão, já na ordem da tabela. */
  rows: readonly MergedOrder[];
  meta: ReadonlyMap<string, AssetMeta>;
  /** O selo "FII"/"Ação" ao lado do ativo, quando há as duas classes. */
  showClass: boolean;
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const rowKey = (row: MergedOrder) => `${row.kind}:${row.order.ticker}`;

/** O porquê em poucas palavras, conforme a classe. */
const shortOf = (row: MergedOrder) =>
  row.kind === "FII" ? shortReason(row.order) : shortStockReason(row.order);

/** A conta inteira numa linha, para a dica da tabela. */
const fullOf = (row: MergedOrder) =>
  row.kind === "FII" ? capitalize(explain(row.order).join(" · ")) : explainStock(row.order);

/** "Cotas" só com FIIs, "Ações" só com ações e "Qtd." com as duas. */
function quantityHeader(rows: readonly MergedOrder[]) {
  if (rows.every((row) => row.kind === "FII")) return "Cotas";
  if (rows.every((row) => row.kind === "ACAO")) return "Ações";
  return "Qtd.";
}

function ClassBadge({ kind }: { kind: OrderKind }) {
  return <Badge variant="outline">{kind === "FII" ? "FII" : "Ação"}</Badge>;
}

/**
 * Tabela das ordens (a partir de 760 px de card), de FIIs, de ações ou das duas. O porquê é um
 * comentário curto e discreto; a conta inteira (nos FIIs, cada tensor, o pedido e a trava; nas
 * ações, a margem e a meta) fica na dica ao passar o mouse.
 */
export function OrdersTable({ rows, meta, showClass }: OrdersProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-(--card-spacing)">Ativo</TableHead>
          <TableHead className="text-right">{quantityHeader(rows)}</TableHead>
          <TableHead className="text-right">Preço</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">% antes → depois</TableHead>
          <TableHead className="text-right">% meta</TableHead>
          <TableHead className="pr-(--card-spacing)">Por quê</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const { order } = row;
          const info = meta.get(order.ticker);
          return (
            <TableRow key={rowKey(row)}>
              <TableCell className="pl-(--card-spacing)">
                {/* O selo à direita da célula: os de todas as linhas ficam numa coluna. */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <AssetLabel
                      ticker={order.ticker}
                      name={info?.name}
                      logoUrl={info?.logoUrl}
                      href={`/ativos/${order.ticker}`}
                    />
                    {info?.ceilingWarning ? (
                      <CeilingCheckIcon
                        check={info.ceilingWarning.check}
                        ceiling={info.ceilingWarning.ceiling}
                        price={order.price}
                      />
                    ) : null}
                  </div>
                  {showClass ? <ClassBadge kind={row.kind} /> : null}
                </div>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                <Sensitive mask={QUANTITY_MASK}>{formatQuantity(order.quantity)}</Sensitive>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(order.price)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                <Sensitive>{formatBRL(order.total)}</Sensitive>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(order.weightBefore, 1)} → {formatPercent(order.weightAfter, 1)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(order.targetWeight, 1)}
              </TableCell>
              <TableCell
                className="min-w-48 pr-(--card-spacing) text-caption whitespace-normal text-muted-foreground"
                title={fullOf(row)}
              >
                {shortOf(row)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/**
 * Celular: cada ordem numa célula, como uma tabela do iOS: o ativo e o total; as cotas (ou ações)
 * × preço e o peso antes → depois; e, discreto, o porquê em poucas palavras. A conta inteira abre
 * numa folha ao tocar, a da classe da ordem, com o chevron dizendo que há mais.
 */
export function OrdersList({ rows, meta, showClass }: OrdersProps) {
  const [sheet] = useState(() => createDrawerHandle<MergedOrder>());
  return (
    <>
      <ul className="divide-y divide-border">
        {rows.map((row) => {
          const { order } = row;
          const info = meta.get(order.ticker);
          return (
            <li key={rowKey(row)}>
              <DrawerTrigger
                handle={sheet}
                payload={row}
                className="flex w-full items-center gap-3 px-(--card-spacing) py-3 text-left outline-none select-none [-webkit-touch-callout:none] focus-visible:bg-foreground/5 active:bg-foreground/8"
              >
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <AssetLabel ticker={order.ticker} name={info?.name} logoUrl={info?.logoUrl} />
                      {info?.ceilingWarning ? (
                        <CeilingCheckIcon
                          check={info.ceilingWarning.check}
                          ceiling={info.ceilingWarning.ceiling}
                          price={order.price}
                          tooltip={false}
                        />
                      ) : null}
                      {showClass ? <ClassBadge kind={row.kind} /> : null}
                    </div>
                    <span className="text-headline whitespace-nowrap tabular-nums">
                      <Sensitive>{formatBRL(order.total)}</Sensitive>
                    </span>
                  </div>
                  <p className="flex justify-between gap-3 text-footnote text-muted-foreground tabular-nums">
                    <span>
                      <Sensitive mask={QUANTITY_MASK}>{formatQuantity(order.quantity)}</Sensitive>{" "}
                      {unitOf(row.kind, order.quantity)} × {formatBRL(order.price)}
                    </span>
                    <span className="whitespace-nowrap">
                      {formatPercent(order.weightBefore, 1)} → {formatPercent(order.weightAfter, 1)}
                    </span>
                  </p>
                  <p className="text-caption text-muted-foreground">{shortOf(row)}</p>
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
          payload ? <RowSheet row={payload} info={meta.get(payload.order.ticker)} /> : null
        }
      </Drawer>
    </>
  );
}

function RowSheet({ row, info }: { row: MergedOrder; info: AssetMeta | undefined }) {
  return row.kind === "FII" ? (
    <OrderSheet order={row.order} info={info} />
  ) : (
    <StockOrderSheet order={row.order} info={info} />
  );
}

/** O detalhe de uma ordem de FII: o porquê em partes (ranking, meta, cada tensor, a trava). */
function OrderSheet({ order, info }: { order: CascadeOrder; info: AssetMeta | undefined }) {
  return (
    <OrderSheetFrame row={{ kind: "FII", order }} info={info}>
      {explain(order).map((reason) => (
        <ReasonRow key={reason}>{capitalize(reason)}</ReasonRow>
      ))}
    </OrderSheetFrame>
  );
}

/** O detalhe de uma ordem de ação: a margem de segurança e o que faltava para a meta. */
function StockOrderSheet({ order, info }: { order: StockBuyOrder; info: AssetMeta | undefined }) {
  return (
    <OrderSheetFrame row={{ kind: "ACAO", order }} info={info}>
      <ReasonRow>{explainStock(order)}</ReasonRow>
    </OrderSheetFrame>
  );
}

function ReasonRow({ children }: { children: ReactNode }) {
  return <div className="flex min-h-11 items-center px-4 py-2 text-subheadline">{children}</div>;
}

/** A folha de uma ordem: o ativo, o que comprar e o peso na carteira da classe; o porquê vem de fora. */
function OrderSheetFrame({
  row,
  info,
  children,
}: {
  row: MergedOrder;
  info: AssetMeta | undefined;
  children: ReactNode;
}) {
  const { order } = row;
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
          <p className="text-title-1 tabular-nums">
            <Sensitive>{formatBRL(order.total)}</Sensitive>
          </p>
          <p className="text-subheadline text-muted-foreground tabular-nums">
            <Sensitive mask={QUANTITY_MASK}>{formatQuantity(order.quantity)}</Sensitive>{" "}
            {unitOf(row.kind, order.quantity)} × ~{formatBRL(order.price)}
          </p>
        </div>
        <InsetGroup
          title={row.kind === "FII" ? "Peso na carteira de FIIs" : "Peso na carteira de ações"}
        >
          <InsetValueRow label="Antes" value={formatPercent(order.weightBefore, 1)} />
          <InsetValueRow label="Depois" value={formatPercent(order.weightAfter, 1)} />
          <InsetValueRow label="Meta" value={formatPercent(order.targetWeight, 1)} />
        </InsetGroup>
        <InsetGroup title="Por quê">{children}</InsetGroup>
        {info?.ceilingWarning ? (
          <InsetGroup title="Aviso">
            <div className="px-4 py-3 text-footnote">
              <CeilingCheckBody
                check={info.ceilingWarning.check}
                ceiling={info.ceilingWarning.ceiling}
                price={order.price}
              />
            </div>
          </InsetGroup>
        ) : null}
      </DrawerBody>
    </DrawerContent>
  );
}
