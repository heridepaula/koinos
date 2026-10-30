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
import { Sensitive } from "@/shared/components/sensitive";

/**
 * Uma linha por FII zerado: custo, vendido e resultado (o IR fica na página própria). As colunas
 * saem pela largura do card (container query, em px); o FII e o resultado ficam sempre.
 *   até 479 px  FII | resultado, selos curtos
 *   480 px      + vendido, selos alinhados com o ticker
 *   600 px      + data
 *   720 px      + custo
 *   840 px      selos longos
 * No celular, a lista de células (ClosedList) e as notas no ⓘ.
 */
export function ClosedPositionsTable({ rows, totals }: ClosedPositionsView) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Por FII</CardTitle>
        <CardDescription>Da encerrada mais recente para a mais antiga.</CardDescription>
        <CardAction className="md:hidden">
          <InfoSheet title="Como a conta é feita" label="Como a conta é feita">
            <ClosedNotes rows={rows} tax={false} inSheet />
          </InfoSheet>
        </CardAction>
      </CardHeader>
      <CardContent className="@container px-0">
        <ClosedList rows={rows} tax={false} total={<Delta value={totals.realizedPnL} />} />
        <Table className="hidden @min-[480px]:table">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">FII</TableHead>
              <TableHead className="hidden @min-[600px]:table-cell">Encerrada em</TableHead>
              <TableHead className="hidden text-right @min-[720px]:table-cell">
                Custo (PM)
              </TableHead>
              <TableHead className="hidden text-right @min-[480px]:table-cell">Vendido</TableHead>
              <TableHead className="pr-(--card-spacing) text-right">Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.ticker}>
                <TableCell className="pl-(--card-spacing)">
                  <ClosedTickerCell row={row} />
                </TableCell>
                <TableCell className="hidden tabular-nums @min-[600px]:table-cell">
                  {formatTradeDate(row.closedAt)}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums @min-[720px]:table-cell">
                  {row.sales > 0 ? <Sensitive>{formatBRL(row.costBasis)}</Sensitive> : "—"}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums @min-[480px]:table-cell">
                  {row.sales > 0 ? <Sensitive>{formatBRL(row.proceeds)}</Sensitive> : "—"}
                </TableCell>
                <TableCell className="pr-(--card-spacing) text-right">
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
              <TableCell className="pl-(--card-spacing) font-medium">Total</TableCell>
              <TableCell className="hidden @min-[600px]:table-cell" />
              <TableCell className="hidden text-right font-semibold tabular-nums @min-[720px]:table-cell">
                <Sensitive>{formatBRL(totals.costBasis)}</Sensitive>
              </TableCell>
              <TableCell className="hidden text-right font-semibold tabular-nums @min-[480px]:table-cell">
                <Sensitive>{formatBRL(totals.proceeds)}</Sensitive>
              </TableCell>
              <TableCell className="pr-(--card-spacing) text-right font-semibold">
                <Delta value={totals.realizedPnL} />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        <div className="max-md:hidden">
          <ClosedNotes rows={rows} tax={false} />
        </div>
      </CardContent>
    </Card>
  );
}
