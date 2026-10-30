import type { ReactNode } from "react";
import { AssetLabel } from "@/shared/components/asset-label";
import { Delta } from "@/shared/components/delta";
import { formatBRL, formatPercent, formatTradeDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import {
  FII_CAPITAL_GAINS_RATE,
  STOCK_CAPITAL_GAINS_RATE,
  STOCK_EXEMPTION_LIMIT,
} from "../../domain/closed-positions";
import type { ClosedPositionsView } from "../../domain/types";
import { Sensitive } from "@/shared/components/sensitive";

type Row = ClosedPositionsView["rows"][number];

/**
 * FII com os selos de incorporação e de preço estimado. Abaixo de 840 px de card, os selos ficam
 * curtos ("incorporado", "estimado"); a partir de 480 px, o pl-8 os alinha com o ticker, depois do logo.
 */
export function ClosedTickerCell({ row }: { row: Row }) {
  return (
    <>
      <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
      {row.incorporatedInto || row.estimatedPrice ? (
        <div className="mt-1 flex flex-wrap gap-1 @min-[480px]:pl-8">
          {row.incorporatedInto ? (
            <Badge variant="outline">
              incorporado
              <span className="hidden @min-[840px]:inline">ao {row.incorporatedInto}</span>
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
    </>
  );
}

const Term = ({ children }: { children: string }) => (
  <strong className="font-medium text-foreground">{children}</strong>
);

/**
 * Celular (card abaixo de 480 px): cada FII numa célula, sem cabeçalho de tabela nem selos: o
 * ativo e, embaixo, a data e as marcas em texto secundário; à direita, o resultado (e, no IR, o
 * imposto). O total fecha a lista.
 */
export function ClosedList({
  rows,
  total,
  tax,
}: {
  rows: readonly Row[];
  total: ReactNode;
  tax: boolean;
}) {
  return (
    <ul className="divide-y divide-border @min-[480px]:hidden">
      {rows.map((row) => {
        // A data curta e as marcas: o detalhe de cada uma está na nota do ⓘ.
        const marks = [
          row.closedAt ? formatTradeDate(row.closedAt) : null,
          row.incorporatedInto ? `→ ${row.incorporatedInto}` : null,
          row.estimatedPrice ? "estimado" : null,
        ].filter(Boolean);
        return (
          <li key={row.ticker} className="flex items-center gap-3 px-(--card-spacing) py-3">
            <div className="grid min-w-0 flex-1 gap-1">
              <AssetLabel ticker={row.ticker} logoUrl={row.logoUrl} />
              {marks.length > 0 ? (
                <p className="text-footnote text-muted-foreground tabular-nums">
                  {marks.join(" · ")}
                </p>
              ) : null}
            </div>
            <div className="grid justify-items-end gap-0.5 text-right">
              {row.sales > 0 ? (
                <Delta
                  value={row.realizedPnL}
                  pct={tax ? undefined : row.realizedPct}
                  stacked={!tax}
                  className="text-subheadline"
                />
              ) : (
                <span className="text-footnote text-muted-foreground">sem venda</span>
              )}
              {tax ? (
                <span className="text-footnote text-muted-foreground tabular-nums">
                  {row.estimatedTax > 0 ? (
                    <>
                      IR <Sensitive>{formatBRL(row.estimatedTax)}</Sensitive>
                    </>
                  ) : row.taxExempt ? (
                    "isento"
                  ) : (
                    "sem IR"
                  )}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
      <li className="flex items-center justify-between gap-3 px-(--card-spacing) pt-3 font-semibold">
        <span>Total</span>
        {total}
      </li>
    </ul>
  );
}

/** Notas de rodapé das tabelas: só as que se aplicam às linhas mostradas (no celular, no ⓘ). */
export function ClosedNotes({
  rows,
  tax,
  inSheet = false,
}: {
  rows: readonly Row[];
  tax: boolean;
  inSheet?: boolean;
}) {
  const incorporated = rows.some((row) => row.incorporatedInto !== null);
  const estimated = rows.some((row) => row.estimatedPrice);
  return (
    <ul
      className={cn(
        "grid gap-2 text-muted-foreground",
        inSheet ? "gap-3 text-subheadline" : "mt-4 px-(--card-spacing) text-footnote",
      )}
    >
      {tax ? (
        <li>
          <Term>IR estimado:</Term> nos FIIs, {formatPercent(FII_CAPITAL_GAINS_RATE, 0)} do lucro de
          cada posição, porque a venda de cotas de FII não tem isenção. Nas ações,{" "}
          {formatPercent(STOCK_CAPITAL_GAINS_RATE, 0)} do lucro do mês em que as vendas de ações
          passaram de {formatBRL(STOCK_EXEMPTION_LIMIT)}; até esse valor, o mês é isento. Prejuízo
          não paga. Na declaração, o IR é apurado mês a mês, compensando os prejuízos anteriores.
          Esta estimativa não compensa.
        </li>
      ) : (
        <li>
          <Term>Custo (PM):</Term> as cotas vendidas pelo preço médio do dia de cada venda, com as
          taxas de compra. <Term>Vendido:</Term> o valor das vendas, sem as taxas.
        </li>
      )}
      {incorporated ? (
        <li>
          <Term>Incorporado:</Term> incorporação não é venda. O custo das cotas seguiu para o FII
          que as recebeu, sem resultado nem IR.
        </li>
      ) : null}
      {estimated ? (
        <li>
          <Term>Preço estimado:</Term> nem a B3 nem a planilha tinham o preço de compra de algum
          lote deste ativo, e ele foi estimado. O resultado e o IR também são estimativas.
        </li>
      ) : null}
    </ul>
  );
}
