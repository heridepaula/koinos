import { ArrowRightIcon, ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { Delta } from "@/shared/components/delta";
import { formatBRL, formatTradeDate } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { ClosedPositionRow } from "../domain/types";

export function ClosedPositions({ rows }: { rows: readonly ClosedPositionRow[] }) {
  if (rows.length === 0) return null;
  const sales = rows.reduce((sum, row) => sum + row.realizedPnL, 0);
  const dividends = rows.reduce((sum, row) => sum + row.dividends, 0);
  const result = rows.reduce((sum, row) => sum + row.totalResult, 0);
  // As colunas se escondem pela largura do card (container query), não pela da tela: com a sidebar
  // aberta o card é estreito mesmo em telas médias. O Total nunca pode ficar cortado. A venda
  // (Total - Proventos) e a data são as que saem primeiro; o resumo mantém o agregado das vendas.
  return (
    <Card>
      <CardContent className="@container">
        <details className="group">
          {/* Em card estreito os totais descem para a linha de baixo; cada um fica inteiro. */}
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
            <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
            Posições encerradas ({rows.length})
            <span className="flex w-full flex-wrap gap-x-4 gap-y-1 font-normal @min-[640px]:ml-auto @min-[640px]:w-auto @min-[640px]:justify-end">
              <span className="whitespace-nowrap">
                Vendas <Delta value={sales} />
              </span>
              <span className="whitespace-nowrap">
                Proventos <span className="tabular-nums">{formatBRL(dividends)}</span>
              </span>
              <span className="whitespace-nowrap">
                Total <Delta value={result} />
              </span>
            </span>
          </summary>
          {/* pl-0/pr-0 nas pontas: o texto alinha com o resumo acima. */}
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-0">FII</TableHead>
                <TableHead className="hidden @min-[500px]:table-cell">Encerrada em</TableHead>
                <TableHead className="hidden text-right @min-[400px]:table-cell">Vendas</TableHead>
                <TableHead className="text-right">Proventos</TableHead>
                <TableHead className="pr-0 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.ticker}>
                  <TableCell className="pl-0 font-medium">{row.ticker}</TableCell>
                  <TableCell className="hidden text-muted-foreground @min-[500px]:table-cell">
                    {/* Sem data: o FII só aparece pelos proventos, sem lançamento na carteira. */}
                    {row.closedAt ? formatTradeDate(row.closedAt) : "—"}
                  </TableCell>
                  <TableCell className="hidden text-right @min-[400px]:table-cell">
                    <Delta value={row.realizedPnL} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(row.dividends)}
                  </TableCell>
                  <TableCell className="pr-0 text-right">
                    <Delta value={row.totalResult} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {/* Outline, não link: o azul do link fica abaixo de 4,5:1 sobre o card. */}
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            nativeButton={false}
            render={<Link href="/encerradas" />}
          >
            Custo, vendas e IR estimado
            <ArrowRightIcon />
          </Button>
        </details>
      </CardContent>
    </Card>
  );
}
