"use client";

import type { StrategyRow as StrategyRowData } from "@/features/portfolio";
import { InfoSheet } from "@/shared/components/info-sheet";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { suggestPercentFix } from "../domain/weights";
import { AddAssetForm } from "./table/add-asset-form";
import { PercentFixPanel } from "./table/percent-fix-panel";
import { StrategyList } from "./table/strategy-list";
import { StrategyRow } from "./table/strategy-row";
import { Sensitive } from "@/shared/components/sensitive";

const EXPLANATION =
  "Ranking, preço teto e % sugerida pela Suno. Os campos salvam ao sair. Sem teto, o ativo não recebe aporte.";

/**
 * Carteira Alvo: a partir de 900 px de card, a tabela editável; abaixo disso, a lista do celular,
 * em que cada ativo abre uma folha de edição. O painel de ajuste aparece quando as % não fecham
 * 100%; com ele à vista, o rodapé não repete o aviso. No iPhone, o título e a explicação saem
 * (o título grande da página já diz o que é; a explicação vai para o ⓘ), fica a contagem, e o
 * "Adicionar" vai para o "+" ao lado da tab bar.
 */
export function StrategyTable({
  rows,
  strategyValue,
  sumOfSuggested,
  weightsWarning,
}: {
  rows: StrategyRowData[];
  strategyValue: number;
  sumOfSuggested: number;
  weightsWarning: string | null;
}) {
  const members = rows.filter((row) => row.inStrategy);
  const fixes = suggestPercentFix(
    members.map((row) => ({ ticker: row.ticker, suggestedPercent: row.suggestedPercent })),
  );
  const showFix = fixes !== null && fixes.length > 0;

  return (
    <Card className="@container">
      <CardHeader className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="grid gap-1 max-md:hidden">
          <CardTitle>Carteira Alvo</CardTitle>
          <CardDescription>{EXPLANATION}</CardDescription>
        </div>
        <div className="flex w-full items-center justify-between gap-3 md:hidden">
          <CardDescription>{members.length} ativos na estratégia</CardDescription>
          <InfoSheet title="Carteira Alvo" label="Sobre a Carteira Alvo">
            <p>{EXPLANATION}</p>
            <p>Toque num ativo para editar o rank, o teto, a % sugerida e a categoria.</p>
          </InfoSheet>
        </div>
        <AddAssetForm />
      </CardHeader>
      <CardContent className="px-0">
        {showFix ? <PercentFixPanel rows={rows} fixes={fixes} /> : null}
        {rows.length === 0 ? (
          <p className="px-(--card-spacing) py-10 text-center text-muted-foreground">
            Adicione os ativos da carteira recomendada da Suno.
          </p>
        ) : (
          <>
            <div className="@min-[900px]:hidden">
              <StrategyList rows={rows} />
            </div>
            <Table className="hidden @min-[900px]:table">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-card pl-(--card-spacing)">
                    Ativo
                  </TableHead>
                  <TableHead>Estratégia</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Teto (R$)</TableHead>
                  <TableHead>% sugerida</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Preço atual</TableHead>
                  <TableHead className="text-right" title="Margem até o preço teto">
                    Margem
                  </TableHead>
                  <TableHead className="text-right" title="Peso atual na estratégia / peso-alvo">
                    Peso / meta
                  </TableHead>
                  <TableHead title="Prioridade de aporte pelo método Suno">Prioridade</TableHead>
                  <TableHead className="pr-(--card-spacing)" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <StrategyRow key={row.ticker} row={row} />
                ))}
              </TableBody>
            </Table>
          </>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t px-(--card-spacing) pt-4 text-sm text-muted-foreground">
          <span className="max-md:hidden">{members.length} ativos na estratégia</span>
          <span>
            Soma das % sugeridas:{" "}
            <span className="text-foreground tabular-nums">
              {formatPercent(sumOfSuggested / 100, 1)}
            </span>
          </span>
          <span>
            Valor da estratégia:{" "}
            <span className="text-foreground tabular-nums">
              <Sensitive>{formatBRL(strategyValue)}</Sensitive>
            </span>
          </span>
          {weightsWarning && !showFix ? <span className="text-warn">{weightsWarning}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
