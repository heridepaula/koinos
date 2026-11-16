"use client";

import { Sensitive } from "@/shared/components/sensitive";
import { InsetGroup } from "@/shared/components/inset-list";
import { insetRowClass } from "@/shared/components/inset-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { AssetFiscalPosition, TaxReportIdentity } from "../domain/types";
import { CnpjField } from "./cnpj-field";
import { CopyButton } from "./copy-button";
import { CLASS_LABEL, Money, Qty, Seal } from "./parts";

function CheckSeal() {
  return (
    <span className="mt-1 flex">
      <Seal tone="warn">conferir o código no programa da Receita</Seal>
    </span>
  );
}

function flagSeals(position: AssetFiscalPosition) {
  return (
    <>
      {position.flags.includes("PRECO_ESTIMADO") ? <Seal tone="warn">Preço estimado</Seal> : null}
      {position.flags.includes("POSICAO_ANTERIOR") ? <Seal>Posição anterior</Seal> : null}
      {position.closedInYear ? <Seal>Encerrada no ano</Seal> : null}
    </>
  );
}

function Discrimination({ position }: { position: AssetFiscalPosition }) {
  if (position.closedInYear) {
    return (
      <p className="text-muted-foreground">Posição encerrada no ano: declare com valor 0,00.</p>
    );
  }
  if (!position.discrimination) {
    return (
      <p className="text-muted-foreground">Informe o CNPJ para gerar o texto de discriminação.</p>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <p className="min-w-0 flex-1 text-footnote break-words">
        <Sensitive mask="•••••••••">{position.discrimination}</Sensitive>
      </p>
      <CopyButton
        text={position.discrimination}
        label={`Copiar discriminação de ${position.ticker}`}
        iconOnly
      />
    </div>
  );
}

/**
 * Ficha Bens e Direitos: uma linha por ativo com a posição em 31/12 do ano anterior e do ano, a
 * discriminação em texto de modelo fixo e o CNPJ do emissor (editável). Da largura de 760 px do
 * card em diante é tabela; abaixo disso, uma lista agrupada por ativo, sem rolagem lateral.
 */
export function BensTable({
  year,
  positions,
  identities,
}: {
  year: number;
  positions: readonly AssetFiscalPosition[];
  identities: ReadonlyMap<string, TaxReportIdentity>;
}) {
  if (positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bens e Direitos</CardTitle>
          <CardDescription>
            Nenhuma posição em 31/12/{year - 1} nem em 31/12/{year}.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bens e Direitos</CardTitle>
        <CardDescription>
          Posição em 31/12 pelo custo de aquisição (preço médio). Copie a discriminação para o
          programa da Receita.
        </CardDescription>
      </CardHeader>
      <CardContent className="@container px-0">
        <div className="grid gap-4 px-(--card-spacing) @min-[760px]:hidden">
          {positions.map((p) => {
            const identity = identities.get(p.ticker);
            return (
              <InsetGroup key={p.ticker} title={`${p.ticker} · ${CLASS_LABEL[p.assetClass]}`}>
                <div className={insetRowClass(false)}>
                  <span className="flex flex-wrap gap-1.5">{flagSeals(p)}</span>
                </div>
                <div className={insetRowClass(false)}>
                  <span className="flex-1">Grupo e código</span>
                  <span className="text-right text-muted-foreground tabular-nums">
                    {p.receita.group} · {p.receita.code}
                    {p.receita.needsCheck ? <CheckSeal /> : null}
                  </span>
                </div>
                <div className={insetRowClass(false)}>
                  <span className="flex-1">31/12/{year - 1}</span>
                  <span className="grid text-right text-muted-foreground tabular-nums">
                    <Qty value={p.quantityPrevious} />
                    <Money value={p.costPrevious} />
                  </span>
                </div>
                <div className={insetRowClass(false)}>
                  <span className="flex-1">31/12/{year}</span>
                  <span className="grid text-right text-muted-foreground tabular-nums">
                    <Qty value={p.quantity} />
                    <Money value={p.cost} />
                  </span>
                </div>
                <div className={`${insetRowClass(false)} flex-col items-stretch py-3`}>
                  <span className="text-footnote text-muted-foreground">CNPJ do emissor</span>
                  <CnpjField
                    ticker={p.ticker}
                    cnpj={p.cnpj}
                    source={identity?.cnpjSource ?? null}
                  />
                </div>
                <div className={`${insetRowClass(false)} flex-col items-stretch py-3`}>
                  <span className="text-footnote text-muted-foreground">Discriminação</span>
                  <Discrimination position={p} />
                </div>
              </InsetGroup>
            );
          })}
        </div>
        <Table className="hidden @min-[760px]:table">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">Ativo</TableHead>
              <TableHead>Grupo / código</TableHead>
              <TableHead className="text-right">31/12/{year - 1}</TableHead>
              <TableHead className="pr-(--card-spacing) text-right">31/12/{year}</TableHead>
            </TableRow>
          </TableHeader>
          {positions.map((p) => {
            const identity = identities.get(p.ticker);
            return (
              <TableBody key={p.ticker} className="border-b last:border-0">
                <TableRow className="border-0">
                  <TableCell className="pl-(--card-spacing)">
                    <div className="grid gap-1">
                      <span className="font-medium">
                        {p.ticker}{" "}
                        <span className="font-normal text-muted-foreground">
                          {CLASS_LABEL[p.assetClass]}
                        </span>
                      </span>
                      <span className="flex flex-wrap gap-1.5">{flagSeals(p)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {p.receita.group} · {p.receita.code}
                    {p.receita.needsCheck ? <CheckSeal /> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="grid">
                      <Qty value={p.quantityPrevious} />
                      <span className="text-muted-foreground">
                        <Money value={p.costPrevious} />
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                    <span className="grid">
                      <Qty value={p.quantity} />
                      <span className="text-muted-foreground">
                        <Money value={p.cost} />
                      </span>
                    </span>
                  </TableCell>
                </TableRow>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell colSpan={4} className="px-(--card-spacing) pb-4 whitespace-normal">
                    <div className="grid gap-3 @min-[1000px]:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
                      <div className="grid content-start gap-1">
                        <span className="text-footnote text-muted-foreground">CNPJ do emissor</span>
                        <CnpjField
                          ticker={p.ticker}
                          cnpj={p.cnpj}
                          source={identity?.cnpjSource ?? null}
                        />
                      </div>
                      <div className="grid content-start gap-1">
                        <span className="text-footnote text-muted-foreground">Discriminação</span>
                        <Discrimination position={p} />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            );
          })}
        </Table>
      </CardContent>
    </Card>
  );
}
