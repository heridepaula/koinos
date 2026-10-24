"use client";

import { useState } from "react";
import { Delta, DeltaChip } from "@/shared/components/delta";
import { cn } from "@/shared/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import type { PeriodResult } from "../domain/types";

const SINCE: Record<PeriodResult["key"], string> = {
  semana: "desde o fechamento da semana passada",
  mes: "desde o fechamento do mês passado",
  ano: "desde o fechamento de dezembro",
};

/**
 * L/P da semana, do mês e do ano só pela cotação das posições abertas: três segmentos separados
 * por fios de cabelo (lado a lado a partir de 560 px de card, empilhados abaixo disso). Em cada
 * um, o período, a referência, o valor em Title 2 e o % numa cápsula tingida. No iPhone, como no
 * app Bolsa, um controle segmentado escolhe o período e só ele aparece, com o valor em Title 1; a
 * explicação longa vira uma nota curta embaixo.
 */
export function PeriodResults({ results }: { results: PeriodResult[] }) {
  const [selected, setSelected] = useState<PeriodResult["key"]>(results[0]?.key ?? "semana");
  if (results.length === 0) return null;
  const missing = [...new Set(results.flatMap((result) => result.missing))].sort();
  const options = results.map((result) => ({ value: result.key, label: result.label }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Variação da cotação</CardTitle>
        <CardDescription className="max-md:hidden">
          Quanto as posições de hoje ganharam ou perderam só com a cotação. Não conta proventos nem
          vendas; uma compra feita no período conta desde o início dele.
        </CardDescription>
      </CardHeader>
      <CardContent className="@container grid gap-4">
        <SegmentedControl
          label="Período"
          value={selected}
          options={options}
          onChange={setSelected}
          className="w-full md:hidden"
        />
        <dl className="grid divide-y divide-border max-md:divide-y-0 @min-[560px]:grid-cols-3 @min-[560px]:divide-x @min-[560px]:divide-y-0">
          {results.map((result) => (
            <div
              key={result.key}
              className={cn(
                "grid content-start gap-3 py-4 first:pt-0 last:pb-0 @min-[560px]:px-6 @min-[560px]:py-0 @min-[560px]:first:pl-0 @min-[560px]:last:pr-0",
                // No iPhone, só o período escolhido, sem o rótulo (o controle já diz qual é).
                result.key !== selected && "max-md:hidden",
                "max-md:py-0",
              )}
            >
              <dt className="grid gap-1 max-md:order-last">
                <span className="text-subheadline font-semibold max-md:sr-only">
                  {result.label}
                </span>
                <span className="text-footnote text-muted-foreground">
                  {SINCE[result.key]}
                  <span className="md:hidden">, só pela cotação</span>
                </span>
              </dt>
              <dd className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Delta value={result.value} className="text-title-1 md:text-title-2" />
                {result.pct !== null ? <DeltaChip pct={result.pct} showIcon={false} /> : null}
              </dd>
            </div>
          ))}
        </dl>
        {missing.length > 0 ? (
          <p className="text-footnote text-muted-foreground">
            Fora da conta, sem o fechamento de referência: {missing.join(", ")}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
