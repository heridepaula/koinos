import { Delta } from "@/shared/components/delta";
import { formatBRL, formatTradeDate } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import type { ClosedPositionsView } from "../../domain/types";
import { ClosedNotes, ClosedTickerCell } from "./closed-parts";

/**
 * Uma linha por FII zerado: custo, vendido e resultado (o IR fica na página própria). As colunas
 * saem pela largura do card (container query, em px); o FII e o resultado ficam sempre.
 *   até 479 px  FII | resultado, selos curtos
 *   480 px      + vendido, selos alinhados com o ticker
 *   600 px      + data
 *   720 px      + custo
 *   840 px      selos longos
 */
export function ClosedPositionsTable({ rows, totals }: ClosedPositionsView) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Por FII</CardTitle>
        <CardDescription>Da encerrada mais recente para a mais antiga.</CardDescription>
      </CardHeader>
      <CardContent className="@container px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">FII</TableHead>
              <TableHead className="hidden @min-[600px]:table-cell">Encerrada em</TableHead>
              <TableHead className="hidden text-right @min-[720px]:table-cell">
                Custo (PM)
              </TableHead>
              <TableHead className="hidden text-right @min-[480px]:table-cell">Vendido</TableHead>
              <TableHead className="pr-4 text-right">Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.ticker}>
                <TableCell className="pl-4">
                  <ClosedTickerCell row={row} />
                </TableCell>
                <TableCell className="hidden tabular-nums @min-[600px]:table-cell">
                  {formatTradeDate(row.closedAt)}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums @min-[720px]:table-cell">
                  {row.sales > 0 ? formatBRL(row.costBasis) : "—"}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums @min-[480px]:table-cell">
                  {row.sales > 0 ? formatBRL(row.proceeds) : "—"}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {row.sales > 0 ? (
                    <Delta value={row.realizedPnL} pct={row.realizedPct} stacked />
                  ) : (
                    <span className="text-muted-foreground">sem venda</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="pl-4 font-medium">Total</TableCell>
              <TableCell className="hidden @min-[600px]:table-cell" />
              <TableCell className="hidden text-right font-semibold tabular-nums @min-[720px]:table-cell">
                {formatBRL(totals.costBasis)}
              </TableCell>
              <TableCell className="hidden text-right font-semibold tabular-nums @min-[480px]:table-cell">
                {formatBRL(totals.proceeds)}
              </TableCell>
              <TableCell className="pr-4 text-right font-semibold">
                <Delta value={totals.realizedPnL} />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        <ClosedNotes rows={rows} tax={false} />
      </CardContent>
    </Card>
  );
}
