import { AssetLabel } from "@/shared/components/asset-label";
import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { CascadeOrder } from "../../domain/suno-cascade";
import { explain } from "./explain";

export type AssetMeta = { ticker: string; name: string | null; logoUrl: string | null };

type OrdersProps = {
  orders: CascadeOrder[];
  meta: ReadonlyMap<string, AssetMeta>;
  maxSharePercent: number;
};

/** Tabela das ordens (a partir de 760 px de card). */
export function OrdersTable({ orders, meta, maxSharePercent }: OrdersProps) {
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
              {/* A explicação quebra linha: a tabela cabe em telas menores. */}
              <TableCell className="min-w-64 pr-(--card-spacing) text-caption whitespace-normal text-muted-foreground">
                {explain(order, maxSharePercent)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/**
 * Celular: cada ordem numa célula de três linhas, como uma tabela do iOS: o ativo e o total; as
 * cotas × preço e, à direita, o peso antes → depois; a meta e o porquê em texto secundário.
 */
export function OrdersList({ orders, meta, maxSharePercent }: OrdersProps) {
  return (
    <ul className="divide-y divide-border">
      {orders.map((order) => {
        const info = meta.get(order.ticker);
        return (
          <li key={order.ticker} className="grid gap-1 px-(--card-spacing) py-3">
            <div className="flex items-center justify-between gap-3">
              <AssetLabel ticker={order.ticker} name={info?.name} logoUrl={info?.logoUrl} />
              <span className="text-subheadline font-semibold tabular-nums">
                {formatBRL(order.total)}
              </span>
            </div>
            <p className="flex justify-between gap-3 pl-8 text-footnote tabular-nums">
              <span>
                {formatQuantity(order.quantity)} {order.quantity === 1 ? "cota" : "cotas"} ×{" "}
                {formatBRL(order.price)}
              </span>
              <span className="whitespace-nowrap text-muted-foreground">
                {formatPercent(order.weightBefore, 1)} → {formatPercent(order.weightAfter, 1)}
              </span>
            </p>
            <p className="pl-8 text-footnote text-muted-foreground">
              Meta {formatPercent(order.targetWeight, 1)} · {explain(order, maxSharePercent)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
