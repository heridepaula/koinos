"use client";

import dynamic from "next/dynamic";
import { ChartPlaceholder } from "@/shared/components/chart-placeholder";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type { IndependenceSummary } from "../domain/types";
import type { SplitSlice } from "./split-donut";

const DONUT_SIZE = "mx-auto aspect-square w-full max-w-44";

const SplitDonut = dynamic(() => import("./split-donut").then((mod) => mod.SplitDonut), {
  ssr: false,
  loading: () => <ChartPlaceholder className={DONUT_SIZE} />,
});

/** Card da divisão da meta: o que precisa render para sempre e o que acaba com os filhos. */
export function TargetSplit({ summary }: { summary: IndependenceSummary }) {
  const slices: SplitSlice[] = [
    {
      key: "perpetua",
      label: "Caixa perpétuo",
      value: summary.perpetual,
      fill: "var(--chart-1)",
    },
    {
      key: "temporaria",
      label: "Caixa temporário",
      value: summary.temporary,
      fill: "var(--chart-2)",
    },
  ].filter((slice) => slice.value > 0);
  return (
    <Card className="card-lift">
      <CardHeader>
        <CardTitle>Perpétua × temporária</CardTitle>
        <CardDescription>
          A perpétua paga moradia, saúde e lazer para sempre; a temporária, a escola e a saúde dos
          filhos até saírem do orçamento.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {slices.length > 0 ? <SplitDonut data={slices} className={DONUT_SIZE} /> : null}
        <ul className="grid gap-2 text-sm">
          {slices.map((slice) => (
            <li key={slice.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ background: slice.fill }}
                />
                {slice.label}
              </span>
              <span className="font-medium tabular-nums">
                <Sensitive>{formatBRL(slice.value)}</Sensitive>
                <span className="ml-2 text-muted-foreground">
                  {formatPercent(summary.target > 0 ? slice.value / summary.target : 0, 0)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
