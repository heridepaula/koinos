import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type { StockExclusionReason } from "../../domain/stock-buy";
import { STOCK_REASON_HELP, STOCK_REASON_LABELS, STOCK_REASON_ORDER } from "./explain";

/** Ações da estratégia que não recebem nada agora, agrupadas pelo motivo. */
export function StockExcludedCard({
  byReason,
}: {
  byReason: ReadonlyMap<StockExclusionReason, string[]>;
}) {
  const reasons = STOCK_REASON_ORDER.filter((reason) => byReason.has(reason));
  if (reasons.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ações fora deste aporte</CardTitle>
        <CardDescription>
          As ações da estratégia que não recebem nada agora, e por quê.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid divide-y divide-border">
          {reasons.map((reason) => (
            <li key={reason} className="grid gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Badge variant="outline">{STOCK_REASON_LABELS[reason]}</Badge>
                <span className="text-footnote text-muted-foreground">
                  {STOCK_REASON_HELP[reason]}
                </span>
              </div>
              <p className="text-sm font-medium">{byReason.get(reason)!.join(", ")}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
