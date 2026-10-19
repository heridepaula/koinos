import { ChevronDownIcon } from "lucide-react";
import { Delta } from "@/shared/components/delta";
import { formatBRL, formatTradeDate } from "@/shared/lib/format";
import { Card, CardContent } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { ClosedPosition } from "../domain/types";

/** Zera sobras de ponto flutuante (como -1e-13), que a tela mostraria como "-R$ 0,00" em vermelho. */
const settle = (value: number) => (Math.abs(value) < 0.005 ? 0 : value);

export function ClosedPositions({ rows }: { rows: readonly ClosedPosition[] }) {
  if (rows.length === 0) return null;
  const sales = rows.reduce((sum, row) => sum + row.realizedPnL, 0);
  const dividends = rows.reduce((sum, row) => sum + row.dividends, 0);
  const result = rows.reduce((sum, row) => sum + row.totalResult, 0);
  return (
    <Card>
      <CardContent>
        <details className="group">
          {/* Nos celulares os totais descem para a linha de baixo; cada um fica inteiro. */}
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
            <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
            Posições encerradas ({rows.length})
            <span className="flex w-full flex-wrap gap-x-4 gap-y-1 font-normal sm:ml-auto sm:w-auto sm:justify-end">
              <span className="whitespace-nowrap">
                Realizado <Delta value={sales} />
              </span>
              <span className="whitespace-nowrap">
                Proventos <span className="tabular-nums">{formatBRL(dividends)}</span>
              </span>
              <span className="whitespace-nowrap">
                Total <Delta value={result} />
              </span>
            </span>
          </summary>
          {/* pl-0/pr-0 nas pontas: o texto alinha com o resumo acima. Se faltar largura, rola no card. */}
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-0">FII</TableHead>
                <TableHead className="hidden sm:table-cell">Última venda</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Proventos</TableHead>
                <TableHead className="pr-0 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.ticker}>
                  <TableCell className="pl-0 font-medium">{row.ticker}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {formatTradeDate(row.lastDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Delta value={settle(row.realizedPnL)} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(row.dividends)}
                  </TableCell>
                  <TableCell className="pr-0 text-right">
                    <Delta value={settle(row.totalResult)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </details>
      </CardContent>
    </Card>
  );
}
