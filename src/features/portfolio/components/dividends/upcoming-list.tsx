import { CircleAlertIcon } from "lucide-react";
import { AssetLabel } from "@/shared/components/asset-label";
import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { DividendsView } from "../../domain/types";

type Row = DividendsView["upcoming"][number];

function PayBy({ row }: { row: Row }) {
  if (row.payByPassed) {
    return (
      <span title="Passou da data de pagamento: envie os extratos da B3 para confirmar.">
        a confirmar
      </span>
    );
  }
  if (!row.payBy) return <>sem data</>;
  return row.source === "B3" ? (
    <>{formatTradeDate(row.payBy)}</>
  ) : (
    <>~ até {formatTradeDate(row.payBy)}</>
  );
}

function NotDisclosedBadge() {
  return (
    <Badge
      variant="outline"
      className="gap-1 border-warn/40 bg-warn/10 text-warn"
      title="Paga todo mês, mas ainda não divulgou o provento deste mês."
    >
      <CircleAlertIcon aria-hidden />
      não divulgado
    </Badge>
  );
}

/** Proventos a receber: a lista da B3 (extrato de Eventos) e os anúncios do Yahoo depois dela. */
export function UpcomingDividends({
  rows,
  undisclosed,
  forecastAsOf,
}: {
  rows: DividendsView["upcoming"];
  undisclosed: DividendsView["undisclosed"];
  forecastAsOf: Date | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>A receber</CardTitle>
        <CardDescription>
          {forecastAsOf ? (
            <>
              B3: a lista Proventos a Receber do envio de {formatTradeDate(forecastAsOf)}, com a
              data oficial de pagamento. Estimado: anúncio do Yahoo depois desse envio, sobre as
              cotas da véspera da data ex; a data de pagamento é uma estimativa. Quando a data passa
              sem o extrato da B3 confirmar, aparece &quot;a confirmar&quot;. Não divulgado: FII que
              paga todo mês e ainda não anunciou o deste; o valor é o do mês passado.
            </>
          ) : (
            <>
              Cotas na véspera da data ex × valor anunciado. A data de pagamento é uma estimativa;
              quando ela passa sem o extrato da B3 confirmar, aparece &quot;a confirmar&quot;. Não
              divulgado: FII que paga todo mês e ainda não anunciou o deste; o valor é o do mês
              passado.
            </>
          )}
        </CardDescription>
      </CardHeader>
      {/* As colunas de detalhe saem pela largura do card: FII, valor e pagamento ficam sempre. */}
      <CardContent className="@container px-0">
        {rows.length === 0 && undisclosed.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">Nenhum provento anunciado a receber.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">FII</TableHead>
                <TableHead className="hidden @min-[400px]:table-cell">Origem</TableHead>
                <TableHead className="hidden @min-[520px]:table-cell">Data ex</TableHead>
                <TableHead className="hidden text-right @min-[640px]:table-cell">Cotas</TableHead>
                <TableHead className="hidden text-right @min-[640px]:table-cell">
                  Por cota
                </TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="pr-6 text-right">Pagamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                // O Yahoo pode mandar dois eventos do mesmo FII no mesmo dia (normal e extra).
                <TableRow
                  key={`${row.ticker}-${row.source}-${(row.exDate ?? row.payBy)?.toISOString() ?? "sem-data"}-${index}`}
                >
                  <TableCell className="pl-6">
                    <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
                  </TableCell>
                  <TableCell className="hidden @min-[400px]:table-cell">
                    {row.source === "B3" ? (
                      <Badge variant="secondary">B3</Badge>
                    ) : (
                      <Badge variant="outline">estimado</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden tabular-nums @min-[520px]:table-cell">
                    {row.exDate ? formatTradeDate(row.exDate) : "—"}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums @min-[640px]:table-cell">
                    {row.quantity !== null ? formatQuantity(row.quantity) : "—"}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums @min-[640px]:table-cell">
                    {row.perShare !== null ? formatBRL(row.perShare) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatBRL(row.amount)}
                  </TableCell>
                  <TableCell className="pr-6 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                    <PayBy row={row} />
                  </TableCell>
                </TableRow>
              ))}
              {undisclosed.map((row) => (
                <TableRow key={`${row.ticker}-nao-divulgado`}>
                  <TableCell className="pl-6">
                    <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
                  </TableCell>
                  <TableCell className="hidden @min-[400px]:table-cell">
                    <NotDisclosedBadge />
                  </TableCell>
                  <TableCell className="hidden @min-[520px]:table-cell">—</TableCell>
                  <TableCell className="hidden text-right @min-[640px]:table-cell">—</TableCell>
                  <TableCell className="hidden text-right @min-[640px]:table-cell">—</TableCell>
                  <TableCell
                    className="text-right text-muted-foreground tabular-nums"
                    title="Pago no mês passado, como referência."
                  >
                    {formatBRL(row.lastAmount)}
                  </TableCell>
                  <TableCell className="pr-6 text-right whitespace-nowrap text-muted-foreground">
                    {/* Na tela estreita a coluna Origem some: o aviso fica aqui. */}
                    <span className="@min-[400px]:hidden">
                      <NotDisclosedBadge />
                    </span>
                    <span className="hidden @min-[400px]:inline">não divulgado</span>
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
