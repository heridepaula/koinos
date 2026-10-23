import { AssetLabel } from "@/shared/components/asset-label";
import { Delta } from "@/shared/components/delta";
import { formatBRL, formatPercent, formatTradeDate } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
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
import { FII_CAPITAL_GAINS_RATE } from "../../domain/closed-positions";
import type { ClosedPositionsView } from "../../domain/types";

/**
 * Uma linha por FII zerado. As colunas saem pela largura do card (container query, em px); o FII,
 * o resultado e o IR estimado ficam sempre. Mínimos medidos: FII com selo curto ~110 px (~140
 * alinhado com o ticker), resultado ~117, IR ~84 (o cabeçalho quebra), vendido e custo ~111, data
 * ~101. O selo longo ("incorporado ao PMLL11") leva o FII a ~206 px.
 *   até 479 px  FII | resultado | IR, selos curtos
 *   480 px      + vendido, selos alinhados com o ticker
 *   600 px      + data
 *   720 px      + custo
 *   840 px      selos longos
 */
export function ClosedPositionsTable({ rows, totals }: ClosedPositionsView) {
  const incorporated = rows.some((row) => row.incorporatedInto !== null);
  const estimated = rows.some((row) => row.estimatedPrice);
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
              <TableHead className="text-right">Resultado</TableHead>
              <TableHead className="pr-4 text-right whitespace-normal">IR estimado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.ticker}>
                <TableCell className="pl-4">
                  <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
                  {row.incorporatedInto || row.estimatedPrice ? (
                    // A partir de 480 px, o pl-8 alinha os selos com o ticker, depois do logo.
                    <div className="mt-1 flex flex-wrap gap-1 @min-[480px]:pl-8">
                      {row.incorporatedInto ? (
                        <Badge variant="outline">
                          incorporado
                          <span className="hidden @min-[840px]:inline">
                            ao {row.incorporatedInto}
                          </span>
                        </Badge>
                      ) : null}
                      {row.estimatedPrice ? (
                        <Badge variant="outline">
                          <span className="hidden @min-[840px]:inline">preço</span>
                          estimado
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
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
                <TableCell className="text-right">
                  {row.sales > 0 ? (
                    <Delta value={row.realizedPnL} pct={row.realizedPct} stacked />
                  ) : (
                    <span className="text-muted-foreground">sem venda</span>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums">
                  {row.estimatedTax > 0 ? formatBRL(row.estimatedTax) : "—"}
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
              <TableCell className="text-right font-semibold">
                <Delta value={totals.realizedPnL} />
              </TableCell>
              <TableCell className="pr-4 text-right font-semibold tabular-nums">
                {formatBRL(totals.estimatedTax)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        <ul className="mt-4 grid gap-1.5 px-4 text-xs text-muted-foreground">
          <li>
            <strong className="font-medium text-foreground">IR estimado:</strong>{" "}
            {formatPercent(FII_CAPITAL_GAINS_RATE, 0)} do lucro de cada FII, porque a venda de cotas
            de FII não tem isenção; prejuízo não paga. Na declaração, o IR é apurado mês a mês,
            somando as vendas de FII do mês e compensando os prejuízos anteriores. Esta estimativa
            não compensa.
          </li>
          <li>
            <strong className="font-medium text-foreground">Custo (PM):</strong> as cotas vendidas
            pelo preço médio do dia de cada venda, com as taxas de compra.{" "}
            <strong className="font-medium text-foreground">Vendido:</strong> o valor das vendas,
            sem as taxas.
          </li>
          {incorporated ? (
            <li>
              <strong className="font-medium text-foreground">Incorporado:</strong> incorporação não
              é venda. O custo das cotas seguiu para o FII que as recebeu, sem resultado nem IR.
            </li>
          ) : null}
          {estimated ? (
            <li>
              <strong className="font-medium text-foreground">Preço estimado:</strong> nem a B3 nem
              a planilha tinham o preço de compra de algum lote deste FII, e ele foi estimado. O
              resultado e o IR também são estimativas.
            </li>
          ) : null}
        </ul>
      </CardContent>
    </Card>
  );
}
