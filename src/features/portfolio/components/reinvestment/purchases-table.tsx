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
import { QUANTITY_MASK, Sensitive } from "@/shared/components/sensitive";

const KIND_LABELS = { NEGOCIO: "Negócio", SUBSCRICAO: "Subscrição" } as const;

/**
 * Compras em dinheiro do mês. As colunas de detalhe saem pela largura do card; abaixo de 480 px
 * (o celular), uma lista de células: o FII e o total, e embaixo a data, cotas × preço e o tipo.
 */
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
          <p className="px-(--card-spacing) text-sm text-muted-foreground">
            Nenhuma compra no mês.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border @min-[480px]:hidden">
              {rows.map((row, index) => (
                <li
                  key={`${row.ticker}-${row.date.toISOString()}-${index}`}
                  className="grid gap-1 px-(--card-spacing) py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
                    <span className="text-headline font-normal whitespace-nowrap tabular-nums">
                      <Sensitive>{formatBRL(row.total)}</Sensitive>
                    </span>
                  </div>
                  <p className="truncate text-footnote text-muted-foreground tabular-nums">
                    {formatTradeDate(row.date)} ·{" "}
                    <Sensitive mask={QUANTITY_MASK}>{formatQuantity(row.quantity)}</Sensitive> ×{" "}
                    {formatBRL(row.unitPrice)}
                    {row.kind === "SUBSCRICAO" ? " · subscrição" : ""}
                  </p>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 px-(--card-spacing) pt-3 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  <Sensitive>{formatBRL(total)}</Sensitive>
                </span>
              </li>
            </ul>
            <Table className="hidden @min-[480px]:table">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-(--card-spacing)">Data</TableHead>
                  <TableHead>FII</TableHead>
                  <TableHead className="hidden @min-[560px]:table-cell">Tipo</TableHead>
                  <TableHead className="hidden text-right @min-[480px]:table-cell">Qtd.</TableHead>
                  <TableHead className="hidden text-right @min-[640px]:table-cell">Preço</TableHead>
                  <TableHead className="pr-(--card-spacing) text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={`${row.ticker}-${row.date.toISOString()}-${index}`}>
                    <TableCell className="pl-(--card-spacing) tabular-nums">
                      {formatTradeDate(row.date)}
                    </TableCell>
                    <TableCell>
                      <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
                    </TableCell>
                    <TableCell className="hidden @min-[560px]:table-cell">
                      {KIND_LABELS[row.kind]}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums @min-[480px]:table-cell">
                      <Sensitive mask={QUANTITY_MASK}>{formatQuantity(row.quantity)}</Sensitive>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums @min-[640px]:table-cell">
                      {formatBRL(row.unitPrice)}
                    </TableCell>
                    <TableCell className="pr-(--card-spacing) text-right font-medium tabular-nums">
                      <Sensitive>{formatBRL(row.total)}</Sensitive>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-(--card-spacing) font-medium" colSpan={2}>
                    Total
                  </TableCell>
                  <TableCell className="hidden @min-[560px]:table-cell" />
                  <TableCell className="hidden @min-[480px]:table-cell" />
                  <TableCell className="hidden @min-[640px]:table-cell" />
                  <TableCell className="pr-(--card-spacing) text-right font-semibold tabular-nums">
                    <Sensitive>{formatBRL(total)}</Sensitive>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
