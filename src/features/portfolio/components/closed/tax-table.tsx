import { Delta } from "@/shared/components/delta";
import { InfoSheet } from "@/shared/components/info-sheet";
import { formatBRL, formatTradeDate } from "@/shared/lib/format";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
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
import { ClosedList, ClosedNotes, ClosedTickerCell } from "./closed-parts";

/**
 * IR estimado de cada FII zerado: o resultado das vendas e o imposto sobre o lucro. As colunas
 * saem pela largura do card; o FII, o resultado e o IR ficam sempre.
 *   até 479 px  FII | resultado | IR, selos curtos
 *   480 px      + data, selos alinhados com o ticker
 *   840 px      selos longos
 * No celular, a lista de células (ClosedList) e as notas no ⓘ.
 */
export function ClosedTaxTable({ rows, totals }: ClosedPositionsView) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Por FII</CardTitle>
        <CardDescription>Da encerrada mais recente para a mais antiga.</CardDescription>
        <CardAction className="md:hidden">
          <InfoSheet title="Como o IR é estimado" label="Como o IR é estimado">
            <ClosedNotes rows={rows} tax inSheet />
          </InfoSheet>
        </CardAction>
      </CardHeader>
      <CardContent className="@container px-0">
        <ClosedList
          rows={rows}
          tax
          total={
            <span className="text-right tabular-nums">IR {formatBRL(totals.estimatedTax)}</span>
          }
        />
        <Table className="hidden @min-[480px]:table">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">FII</TableHead>
              <TableHead className="hidden @min-[480px]:table-cell">Encerrada em</TableHead>
              <TableHead className="text-right">Resultado</TableHead>
              <TableHead className="pr-(--card-spacing) text-right whitespace-normal">
                IR estimado
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.ticker}>
                <TableCell className="pl-(--card-spacing)">
                  <ClosedTickerCell row={row} />
                </TableCell>
                <TableCell className="hidden tabular-nums @min-[480px]:table-cell">
                  {formatTradeDate(row.closedAt)}
                </TableCell>
                <TableCell className="text-right">
                  {row.sales > 0 ? (
                    <Delta value={row.realizedPnL} />
                  ) : (
                    <span className="text-muted-foreground">sem venda</span>
                  )}
                </TableCell>
                <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                  {row.estimatedTax > 0 ? formatBRL(row.estimatedTax) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="pl-(--card-spacing) font-medium">Total</TableCell>
              <TableCell className="hidden @min-[480px]:table-cell" />
              <TableCell className="text-right font-semibold">
                <Delta value={totals.realizedPnL} />
              </TableCell>
              <TableCell className="pr-(--card-spacing) text-right font-semibold tabular-nums">
                {formatBRL(totals.estimatedTax)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        <div className="max-md:hidden">
          <ClosedNotes rows={rows} tax />
        </div>
      </CardContent>
    </Card>
  );
}
