import { ChevronDownIcon } from "lucide-react";
import { Delta } from "@/shared/components/delta";
import { formatTradeDate } from "@/shared/lib/format";
import { Card, CardContent } from "@/shared/ui/card";
import type { ClosedPosition } from "../domain/types";

export function ClosedPositions({ rows }: { rows: readonly ClosedPosition[] }) {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + row.realizedPnL, 0);
  return (
    <Card>
      <CardContent>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
            <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
            Posições encerradas ({rows.length})
            <span className="ml-auto font-normal">
              Realizado <Delta value={total} />
            </span>
          </summary>
          <ul className="mt-3 grid gap-1.5 text-sm">
            {rows.map((row) => (
              <li key={row.ticker} className="flex items-center gap-3">
                <span className="w-20 font-medium">{row.ticker}</span>
                <span className="text-muted-foreground">
                  última venda em {formatTradeDate(row.lastDate)}
                </span>
                <span className="ml-auto">
                  <Delta value={row.realizedPnL} />
                </span>
              </li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}
