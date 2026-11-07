import { TRANSACTION_KIND_LABELS } from "@/features/transactions";
import { Disclosure } from "@/shared/components/disclosure";
import { QUANTITY_MASK, Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type { AssetOrder, AssetOverview } from "../../domain/types";
import { CardLink } from "./card-link";

/** Quantas ordens aparecem antes do "Mostrar todas". */
const VISIBLE = 5;

function OrderRows({ orders }: { orders: AssetOrder[] }) {
  return (
    <ul className="divide-y divide-border/70">
      {orders.map((order, index) => {
        const gross = order.quantity * order.unitPrice;
        const total = order.type === "BUY" ? gross + order.fees : gross - order.fees;
        const kind = order.kind === "NEGOCIO" ? null : TRANSACTION_KIND_LABELS[order.kind];
        return (
          <li
            key={`${order.date.toISOString()}-${order.type}-${index}`}
            className="flex min-h-13 items-center justify-between gap-4 py-2"
          >
            <div className="grid min-w-0 gap-0.5">
              <span className="font-medium">
                {order.type === "BUY" ? "Compra" : "Venda"}
                {kind ? <span className="font-normal text-muted-foreground"> · {kind}</span> : null}
              </span>
              <span className="text-footnote text-muted-foreground">
                {formatTradeDate(order.date)}
              </span>
            </div>
            <div className="grid justify-items-end gap-0.5 text-right tabular-nums">
              <span className="font-medium">
                <Sensitive>{formatBRL(total)}</Sensitive>
              </span>
              <span className="text-footnote text-muted-foreground">
                <Sensitive mask={QUANTITY_MASK}>{formatQuantity(order.quantity)}</Sensitive> ×{" "}
                {formatBRL(order.unitPrice)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** As ordens do ativo, das mais recentes às mais antigas. Editar continua em Transações. */
export function OrdersCard({
  overview,
  className,
}: {
  overview: AssetOverview;
  className?: string;
}) {
  const { orders, ticker } = overview;
  if (orders.length === 0) return null;
  const first = orders[orders.length - 1];
  const visible = orders.slice(0, VISIBLE);
  const rest = orders.slice(VISIBLE);
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>
          <h2>Ordens</h2>
        </CardTitle>
        <CardDescription>
          {orders.length} {orders.length === 1 ? "lançamento" : "lançamentos"} desde{" "}
          {formatTradeDate(first.date)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-1">
        <OrderRows orders={visible} />
        {rest.length > 0 ? (
          <Disclosure
            summary={`Mostrar mais ${rest.length}`}
            className="border-t border-border/70 pt-3"
          >
            <OrderRows orders={rest} />
          </Disclosure>
        ) : null}
        <CardLink href={`/transacoes?ativo=${ticker}`}>Ver em Transações</CardLink>
      </CardContent>
    </Card>
  );
}
