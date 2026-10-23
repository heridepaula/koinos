import { AssetLabel } from "@/shared/components/asset-label";
import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";
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
import type { ReinvestmentView } from "../../domain/types";

const KIND_LABELS = { NEGOCIO: "Negócio", SUBSCRICAO: "Subscrição" } as const;

/** Compras em dinheiro do mês. As colunas de detalhe saem pela largura do card. */
export function PurchasesTable({ rows }: { rows: ReinvestmentView["purchases"] }) {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compras do mês</CardTitle>
        <CardDescription>Negócios e subscrições, com taxas.</CardDescription>
      </CardHeader>
      <CardContent className="@container px-0">
        {rows.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">Nenhuma compra no mês.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Data</TableHead>
                <TableHead>FII</TableHead>
                <TableHead className="hidden @min-[560px]:table-cell">Tipo</TableHead>
                <TableHead className="hidden text-right @min-[480px]:table-cell">Qtd.</TableHead>
                <TableHead className="hidden text-right @min-[640px]:table-cell">Preço</TableHead>
                <TableHead className="pr-6 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={`${row.ticker}-${row.date.toISOString()}-${index}`}>
                  <TableCell className="pl-6 tabular-nums">{formatTradeDate(row.date)}</TableCell>
                  <TableCell>
                    <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
                  </TableCell>
                  <TableCell className="hidden @min-[560px]:table-cell">
                    {KIND_LABELS[row.kind]}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums @min-[480px]:table-cell">
                    {formatQuantity(row.quantity)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums @min-[640px]:table-cell">
                    {formatBRL(row.unitPrice)}
                  </TableCell>
                  <TableCell className="pr-6 text-right font-medium tabular-nums">
                    {formatBRL(row.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-6 font-medium" colSpan={2}>
                  Total
                </TableCell>
                <TableCell className="hidden @min-[560px]:table-cell" />
                <TableCell className="hidden @min-[480px]:table-cell" />
                <TableCell className="hidden @min-[640px]:table-cell" />
                <TableCell className="pr-6 text-right font-semibold tabular-nums">
                  {formatBRL(total)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
