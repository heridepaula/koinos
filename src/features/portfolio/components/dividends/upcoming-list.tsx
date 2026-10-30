import { CircleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AssetLabel } from "@/shared/components/asset-label";
import { InfoSheet } from "@/shared/components/info-sheet";
import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { DividendsView } from "../../domain/types";
import { QUANTITY_MASK, Sensitive } from "@/shared/components/sensitive";

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

/**
 * Legenda no pé da lista, só com o que aparece nela: o que cada origem quer dizer e quando surge o
 * "a confirmar". Substitui o parágrafo longo que explicava tudo de uma vez no cabeçalho.
 */
function UpcomingLegend({
  rows,
  undisclosed,
  inSheet = false,
}: {
  rows: Row[];
  undisclosed: boolean;
  /** Dentro da folha ⓘ do celular: sem o recuo do card. */
  inSheet?: boolean;
}) {
  const items: { key: string; term: ReactNode; text: string }[] = [];
  if (rows.some((row) => row.source === "B3")) {
    items.push({
      key: "b3",
      term: <Badge variant="secondary">B3</Badge>,
      text: "data oficial de pagamento",
    });
  }
  if (rows.some((row) => row.source === "YAHOO")) {
    items.push({
      key: "yahoo",
      term: <Badge variant="outline">estimado</Badge>,
      text: "anúncio do Yahoo; a data de pagamento é uma estimativa",
    });
  }
  if (undisclosed) {
    items.push({
      key: "nao-divulgado",
      term: <NotDisclosedBadge />,
      text: "paga todo mês e ainda não anunciou; o valor é o do mês passado",
    });
  }
  if (rows.some((row) => row.payByPassed)) {
    items.push({
      key: "a-confirmar",
      term: <span className="font-medium whitespace-nowrap text-foreground">a confirmar</span>,
      text: "a data passou sem o extrato da B3 confirmar",
    });
  }
  if (items.length === 0) return null;
  // No celular, uma grade (termo | explicação) para as explicações não ziguezaguearem; em card
  // largo, os pares seguem em linha.
  return (
    <dl
      className={cn(
        "text-muted-foreground",
        inSheet
          ? "grid gap-4 text-subheadline"
          : "grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-(--card-spacing) pt-4 text-footnote @min-[640px]:flex @min-[640px]:flex-wrap @min-[640px]:gap-x-6",
      )}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            inSheet
              ? "grid justify-items-start gap-1.5"
              : "contents @min-[640px]:flex @min-[640px]:items-center @min-[640px]:gap-2",
          )}
        >
          <dt className="justify-self-start">{item.term}</dt>
          <dd>{item.text}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Celular (card abaixo de 400 px): cada provento numa célula, como as listas do iOS: o FII à
 * esquerda; o valor e o pagamento à direita. O "não divulgado" leva o selo no lugar da data.
 */
function UpcomingPhoneList({
  rows,
  undisclosed,
}: {
  rows: DividendsView["upcoming"];
  undisclosed: DividendsView["undisclosed"];
}) {
  return (
    <ul className="divide-y divide-border @min-[400px]:hidden">
      {rows.map((row, index) => (
        <li
          key={`${row.ticker}-${row.source}-${(row.exDate ?? row.payBy)?.toISOString() ?? "sem-data"}-${index}`}
          className="flex items-center gap-3 px-(--card-spacing) py-3"
        >
          <div className="min-w-0 flex-1">
            <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} size="lg" />
          </div>
          <div className="grid justify-items-end gap-0.5">
            <span className="text-headline font-normal tabular-nums">
              <Sensitive>{formatBRL(row.amount)}</Sensitive>
            </span>
            <span className="text-footnote whitespace-nowrap text-muted-foreground tabular-nums">
              <PayBy row={row} />
            </span>
          </div>
        </li>
      ))}
      {undisclosed.map((row) => (
        <li
          key={`${row.ticker}-nao-divulgado`}
          className="flex items-center gap-3 px-(--card-spacing) py-3"
        >
          <div className="min-w-0 flex-1">
            <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} size="lg" />
          </div>
          <div className="grid justify-items-end gap-1">
            <span
              className="text-headline font-normal text-muted-foreground tabular-nums"
              title="Pago no mês passado, como referência."
            >
              <Sensitive>{formatBRL(row.lastAmount)}</Sensitive>
            </span>
            <NotDisclosedBadge />
          </div>
        </li>
      ))}
    </ul>
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
  const description = forecastAsOf
    ? `Da lista Proventos a Receber da B3 (envio de ${formatTradeDate(forecastAsOf)}) e, nos FIIs, dos anúncios do Yahoo depois dela.`
    : "Pelos anúncios do Yahoo, sobre as cotas da véspera da data ex.";
  return (
    <Card>
      <CardHeader>
        <CardTitle>A receber</CardTitle>
        <CardDescription className="max-md:hidden">{description}</CardDescription>
        {/* No celular, a origem e a legenda ficam na folha ⓘ: a lista é o que importa. */}
        <CardAction className="md:hidden">
          <InfoSheet title="A receber" label="Sobre a lista a receber">
            <p>{description}</p>
            <UpcomingLegend rows={rows} undisclosed={undisclosed.length > 0} inSheet />
          </InfoSheet>
        </CardAction>
      </CardHeader>
      {/* As colunas de detalhe saem pela largura do card: FII, valor e pagamento ficam sempre. */}
      <CardContent className="@container px-0">
        {rows.length === 0 && undisclosed.length === 0 ? (
          <p className="px-(--card-spacing) text-sm text-muted-foreground">
            Nenhum provento anunciado a receber.
          </p>
        ) : (
          <>
            <UpcomingPhoneList rows={rows} undisclosed={undisclosed} />
            <Table className="hidden @min-[400px]:table">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-(--card-spacing)">Ativo</TableHead>
                  <TableHead className="hidden @min-[400px]:table-cell">Origem</TableHead>
                  <TableHead className="hidden @min-[520px]:table-cell">Data ex</TableHead>
                  <TableHead className="hidden text-right @min-[640px]:table-cell">Qtd.</TableHead>
                  <TableHead className="hidden text-right @min-[640px]:table-cell">
                    Unitário
                  </TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="pr-(--card-spacing) text-right">Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  // O Yahoo pode mandar dois eventos do mesmo FII no mesmo dia (normal e extra).
                  <TableRow
                    key={`${row.ticker}-${row.source}-${(row.exDate ?? row.payBy)?.toISOString() ?? "sem-data"}-${index}`}
                  >
                    <TableCell className="pl-(--card-spacing)">
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
                      {row.quantity !== null ? (
                        <Sensitive mask={QUANTITY_MASK}>{formatQuantity(row.quantity)}</Sensitive>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums @min-[640px]:table-cell">
                      {row.perShare !== null ? formatBRL(row.perShare) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      <Sensitive>{formatBRL(row.amount)}</Sensitive>
                    </TableCell>
                    <TableCell className="pr-(--card-spacing) text-right whitespace-nowrap text-muted-foreground tabular-nums">
                      <PayBy row={row} />
                    </TableCell>
                  </TableRow>
                ))}
                {undisclosed.map((row) => (
                  <TableRow key={`${row.ticker}-nao-divulgado`}>
                    <TableCell className="pl-(--card-spacing)">
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
                      <Sensitive>{formatBRL(row.lastAmount)}</Sensitive>
                    </TableCell>
                    <TableCell className="pr-(--card-spacing) text-right whitespace-nowrap text-muted-foreground">
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
          </>
        )}
        <div className="max-md:hidden">
          <UpcomingLegend rows={rows} undisclosed={undisclosed.length > 0} />
        </div>
      </CardContent>
    </Card>
  );
}
