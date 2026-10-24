import { AssetLabel } from "@/shared/components/asset-label";
import { formatPercent } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { FII_CAPITAL_GAINS_RATE } from "../../domain/closed-positions";
import type { ClosedPositionsView } from "../../domain/types";

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

/** Notas de rodapé das tabelas: só as que se aplicam às linhas mostradas. */
export function ClosedNotes({ rows, tax }: { rows: readonly Row[]; tax: boolean }) {
  const incorporated = rows.some((row) => row.incorporatedInto !== null);
  const estimated = rows.some((row) => row.estimatedPrice);
  return (
    <ul className="mt-4 grid gap-2 px-(--card-spacing) text-footnote text-muted-foreground">
      {tax ? (
        <li>
          <Term>IR estimado:</Term> {formatPercent(FII_CAPITAL_GAINS_RATE, 0)} do lucro de cada FII,
          porque a venda de cotas de FII não tem isenção; prejuízo não paga. Na declaração, o IR é
          apurado mês a mês, somando as vendas de FII do mês e compensando os prejuízos anteriores.
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
          lote deste FII, e ele foi estimado. O resultado e o IR também são estimativas.
        </li>
      ) : null}
    </ul>
  );
}
