import { AssetLabel } from "@/shared/components/asset-label";
import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { DividendsView } from "../../domain/types";

/** Proventos anunciados que o extrato da B3 ainda não confirmou. */
export function UpcomingDividends({ rows }: { rows: DividendsView["upcoming"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>A receber</CardTitle>
        <CardDescription>
          Cotas na véspera da data ex × valor anunciado. A data de pagamento é uma estimativa;
          quando ela passa sem o extrato da B3 confirmar, aparece &quot;a confirmar&quot;.
        </CardDescription>
      </CardHeader>
      {/* As colunas de detalhe saem pela largura do card: FII, valor e pagamento ficam sempre. */}
      <CardContent className="@container px-0">
        {rows.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">Nenhum provento anunciado a receber.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">FII</TableHead>
                <TableHead className="hidden @min-[480px]:table-cell">Data ex</TableHead>
                <TableHead className="hidden text-right @min-[600px]:table-cell">Cotas</TableHead>
                <TableHead className="hidden text-right @min-[600px]:table-cell">
                  Por cota
                </TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="pr-6 text-right">Pagamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                // O Yahoo pode mandar dois eventos do mesmo FII no mesmo dia (normal e extra).
                <TableRow key={`${row.ticker}-${row.exDate.toISOString()}-${index}`}>
                  <TableCell className="pl-6">
                    <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
                  </TableCell>
                  <TableCell className="hidden tabular-nums @min-[480px]:table-cell">
                    {formatTradeDate(row.exDate)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums @min-[600px]:table-cell">
                    {formatQuantity(row.quantity)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums @min-[600px]:table-cell">
                    {formatBRL(row.perShare)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatBRL(row.amount)}
                  </TableCell>
                  <TableCell className="pr-6 text-right whitespace-nowrap text-muted-foreground">
                    {row.payByPassed ? (
                      <span title="Passou da data estimada: importe o extrato da B3 para confirmar.">
                        a confirmar
                      </span>
                    ) : (
                      <>~ até {formatTradeDate(row.payBy)}</>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
