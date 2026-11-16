"use client";

import { InsetGroup, insetRowClass } from "@/shared/components/inset-list";
import { Sensitive } from "@/shared/components/sensitive";
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
import { round2 } from "../domain/format";
import type { DividendFiscalItem } from "../domain/types";
import type { UnclassifiedReason } from "../domain/year-dividends";
import { Money, Seal, monthText } from "./parts";
import type { FiscalYearReport } from "../domain/types";

const CHECK_NOTE =
  "Confira o valor da ficha com o informe de rendimentos da empresa ou da corretora.";

const REASON_TEXT: Record<UnclassifiedReason, string> = {
  REEMBOLSO: "Reembolso: confira de qual provento é",
  ALUGUEL: "Aluguel de ativos: confira como declarar",
  SEM_CLASSE: "Ativo sem classe conhecida",
  TIPO_FORA_DA_FICHA: "Tipo de provento incomum para a classe",
};

function Source({ item }: { item: DividendFiscalItem }) {
  return (
    <span className="grid gap-0.5">
      <span className="font-medium tabular-nums">
        {item.cnpj ? (
          <Sensitive mask="••.•••.•••/••••-••">{item.sourceKey}</Sensitive>
        ) : (
          item.sourceKey
        )}
      </span>
      <span className="text-footnote text-muted-foreground">{item.tickers.join(", ")}</span>
    </span>
  );
}

function CodeCell({ item }: { item: DividendFiscalItem }) {
  return (
    <span className="grid max-w-full min-w-0 justify-items-start gap-1">
      <span className="tabular-nums">
        {item.receita.group} · código {item.receita.code}
      </span>
      {item.receita.needsCheck ? (
        <Seal tone="warn">conferir o código no programa da Receita</Seal>
      ) : null}
    </span>
  );
}

/**
 * Uma ficha de proventos por fonte pagadora: líquido, bruto e retido (o JCP vem líquido dos 15%).
 * Da largura de 640 px do card em diante é tabela; abaixo disso, lista agrupada.
 */
function DividendSheetCard({
  title,
  description,
  items,
  wide,
  empty,
}: {
  title: string;
  description: string;
  items: readonly DividendFiscalItem[];
  /** Mostra bruto e retido (tributação exclusiva). */
  wide: boolean;
  empty: string;
}) {
  const sum = (pick: (item: DividendFiscalItem) => number) =>
    round2(items.reduce((total, item) => total + pick(item), 0));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="@container grid gap-4 px-0">
        {items.length === 0 ? (
          <p className="px-(--card-spacing) text-muted-foreground">{empty}</p>
        ) : (
          <>
            <div className="grid gap-4 px-(--card-spacing) @min-[640px]:hidden">
              {items.map((item) => (
                <InsetGroup key={`${item.sheet}-${item.sourceKey}`}>
                  <div className={`${insetRowClass(false)} flex-col items-stretch py-3`}>
                    <Source item={item} />
                  </div>
                  <div className={`${insetRowClass(false)} py-3`}>
                    <span className="flex-1">Ficha</span>
                    <CodeCell item={item} />
                  </div>
                  <div className={insetRowClass(false)}>
                    <span className="flex-1">Líquido</span>
                    <span className="tabular-nums">
                      <Money value={item.net} />
                    </span>
                  </div>
                  {wide ? (
                    <>
                      <div className={insetRowClass(false)}>
                        <span className="flex-1">Bruto</span>
                        <span className="text-muted-foreground tabular-nums">
                          <Money value={item.gross} />
                        </span>
                      </div>
                      <div className={insetRowClass(false)}>
                        <span className="flex-1">Retido</span>
                        <span className="text-muted-foreground tabular-nums">
                          <Money value={item.withheld} />
                        </span>
                      </div>
                    </>
                  ) : null}
                </InsetGroup>
              ))}
              <p className="px-4 text-right font-semibold tabular-nums">
                Total líquido <Money value={sum((i) => i.net)} />
              </p>
            </div>
            <Table className="hidden @min-[640px]:table">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-(--card-spacing)">Fonte pagadora</TableHead>
                  <TableHead>Ficha</TableHead>
                  <TableHead className={wide ? "text-right" : "pr-(--card-spacing) text-right"}>
                    Líquido
                  </TableHead>
                  {wide ? <TableHead className="text-right">Bruto</TableHead> : null}
                  {wide ? (
                    <TableHead className="pr-(--card-spacing) text-right">Retido</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={`${item.sheet}-${item.sourceKey}`}>
                    <TableCell className="pl-(--card-spacing) whitespace-normal">
                      <Source item={item} />
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <CodeCell item={item} />
                    </TableCell>
                    <TableCell
                      className={
                        wide
                          ? "text-right tabular-nums"
                          : "pr-(--card-spacing) text-right tabular-nums"
                      }
                    >
                      <Money value={item.net} />
                    </TableCell>
                    {wide ? (
                      <TableCell className="text-right tabular-nums">
                        <Money value={item.gross} />
                      </TableCell>
                    ) : null}
                    {wide ? (
                      <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                        <Money value={item.withheld} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="pl-(--card-spacing) font-medium">
                    Total
                  </TableCell>
                  <TableCell
                    className={
                      wide
                        ? "text-right font-semibold tabular-nums"
                        : "pr-(--card-spacing) text-right font-semibold tabular-nums"
                    }
                  >
                    <Money value={sum((i) => i.net)} />
                  </TableCell>
                  {wide ? (
                    <TableCell className="text-right font-semibold tabular-nums">
                      <Money value={sum((i) => i.gross)} />
                    </TableCell>
                  ) : null}
                  {wide ? (
                    <TableCell className="pr-(--card-spacing) text-right font-semibold tabular-nums">
                      <Money value={sum((i) => i.withheld)} />
                    </TableCell>
                  ) : null}
                </TableRow>
              </TableFooter>
            </Table>
          </>
        )}
        <p className="px-(--card-spacing) text-footnote text-muted-foreground">{CHECK_NOTE}</p>
      </CardContent>
    </Card>
  );
}

function Unclassified({ items }: { items: FiscalYearReport["unclassified"] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fora das fichas (confira)</CardTitle>
        <CardDescription>
          Proventos que o Koinos não soube em qual ficha pôr. Nenhum entra nos totais acima.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <ul className="grid divide-y divide-border">
          {items.map((u, index) => (
            <li
              key={`${u.ticker}-${u.kind}-${u.month}-${index}`}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
            >
              <span className="grid">
                <span className="font-medium">
                  {u.ticker}{" "}
                  <span className="font-normal text-muted-foreground">· {monthText(u.month)}</span>
                </span>
                <span className="text-footnote text-muted-foreground">{REASON_TEXT[u.reason]}</span>
              </span>
              <span className="tabular-nums">
                <Money value={u.amount} />
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Aba "Rendimentos isentos": a ficha e, embaixo, o que ficou fora das fichas. */
export function ExemptTab({ report }: { report: FiscalYearReport }) {
  return (
    <div className="grid gap-4 md:gap-6">
      <DividendSheetCard
        title="Rendimentos isentos e não tributáveis"
        description="Rendimentos de FII e dividendos de ações, por fonte pagadora."
        items={report.exempt}
        wide={false}
        empty="Nenhum rendimento isento neste ano."
      />
      <Unclassified items={report.unclassified} />
    </div>
  );
}

/** Aba "Tributação exclusiva": o JCP, que vem líquido dos 15% retidos na fonte. */
export function ExclusiveTab({ report }: { report: FiscalYearReport }) {
  return (
    <div className="grid gap-4 md:gap-6">
      <DividendSheetCard
        title="Tributação exclusiva/definitiva"
        description="Juros sobre capital próprio, por fonte pagadora: bruto, imposto retido e líquido."
        items={report.exclusive}
        wide
        empty="Nenhum JCP neste ano."
      />
      {report.unclassified.length > 0 ? (
        <p className="text-footnote text-muted-foreground">
          Reembolsos e aluguéis ficam fora das fichas: veja o bloco &quot;Fora das fichas&quot; em
          Rendimentos isentos.
        </p>
      ) : null}
    </div>
  );
}
