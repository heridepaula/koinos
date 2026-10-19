import { ChevronDownIcon } from "lucide-react";
import { Delta } from "@/shared/components/delta";
import { formatBRL, formatTradeDate } from "@/shared/lib/format";
import { Card, CardContent } from "@/shared/ui/card";
import type { ClosedPosition } from "../domain/types";

export function ClosedPositions({ rows }: { rows: readonly ClosedPosition[] }) {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + row.realizedPnL, 0);
  const dividends = rows.reduce((sum, row) => sum + row.dividends, 0);
  const result = rows.reduce((sum, row) => sum + row.totalResult, 0);
  return (
    <Card>
      <CardContent>
        <details className="group">
          {/* Quebra de linha em telas estreitas: cada total fica inteiro na sua linha. */}
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
            <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
            Posições encerradas ({rows.length})
            <span className="ml-auto flex flex-wrap justify-end gap-x-4 gap-y-1 font-normal">
              <span className="whitespace-nowrap">
                Realizado <Delta value={total} />
              </span>
              <span className="whitespace-nowrap">
                Proventos <span className="tabular-nums">{formatBRL(dividends)}</span>
              </span>
              <span className="whitespace-nowrap">
                Total <Delta value={result} />
              </span>
            </span>
          </summary>
          <ul className="mt-3 grid gap-1.5 text-sm">
            {rows.map((row) => (
              <li key={row.ticker} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="w-20 font-medium">{row.ticker}</span>
                <span className="text-muted-foreground">
                  última venda em {formatTradeDate(row.lastDate)}
                </span>
                <span className="ml-auto flex gap-4">
                  <span className="text-muted-foreground tabular-nums">
                    {formatBRL(row.dividends)}
                  </span>
                  {/* Largura mínima só para alinhar a coluna de proventos; nada fixo que estoure. */}
                  <span className="min-w-32 text-right">
                    <Delta value={row.totalResult} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}
