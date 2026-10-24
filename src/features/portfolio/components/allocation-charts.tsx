"use client";

import { Pie, PieChart } from "recharts";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/shared/ui/chart";
import { OTHERS_KEY, UNCATEGORIZED_KEY } from "../domain/allocation";
import type { AllocationSlice } from "../domain/types";
import { ChartTooltipRow } from "./chart-tooltip-row";

// A cor segue a entidade: cada categoria tem sempre o mesmo slot da paleta.
const CATEGORY_SLOT: Record<string, number> = {
  FII_TIJOLO: 1,
  FII_PAPEL: 2,
  FII_HIBRIDO: 3,
  FII_FOF: 4,
  FIAGRO: 5,
  ACAO: 6,
  ETF: 7,
  OUTRO: 8,
};
const NEUTRAL = "var(--muted-foreground)";

type Mode = "category" | "asset";

function colorFor(slice: AllocationSlice, index: number, mode: Mode): string {
  if (slice.key === OTHERS_KEY || slice.key === UNCATEGORIZED_KEY) return NEUTRAL;
  const slot = mode === "category" ? CATEGORY_SLOT[slice.key] : index + 1;
  return slot ? `var(--chart-${slot})` : NEUTRAL;
}

function Donut({
  title,
  description,
  slices,
  mode,
}: {
  title: string;
  description: string;
  slices: AllocationSlice[];
  mode: Mode;
}) {
  const data = slices.map((slice, index) => ({ ...slice, fill: colorFor(slice, index, mode) }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid items-center gap-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
        <ChartContainer config={{}} className="mx-auto aspect-square w-full max-w-48">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name, item) => (
                    <ChartTooltipRow
                      color={String(item.payload?.fill ?? NEUTRAL)}
                      label={name}
                      value={`${formatBRL(Number(value))} · ${formatPercent(Number(item.payload?.share ?? 0), 1)}`}
                    />
                  )}
                />
              }
            />
            {/* O traço na cor do card é o vão de 2px entre as fatias. */}
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="58%"
              outerRadius="100%"
              stroke="var(--card)"
              strokeWidth={2}
            />
          </PieChart>
        </ChartContainer>
        {/* Legenda com valores visíveis: a identidade nunca depende só da cor. */}
        <ul className="grid gap-1.5 text-sm">
          {data.map((slice) => (
            <li key={slice.key} className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ background: slice.fill }}
              />
              <span className="truncate">{slice.label}</span>
              <span className="ml-auto text-muted-foreground tabular-nums">
                {formatPercent(slice.share, 1)}
              </span>
              <span className="w-28 text-right tabular-nums">{formatBRL(slice.value)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function AllocationCharts({
  byCategory,
  byAsset,
}: {
  byCategory: AllocationSlice[];
  byAsset: AllocationSlice[];
}) {
  return (
    <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
      <Donut
        title="Por categoria"
        description="Defina as categorias na Carteira Alvo"
        slices={byCategory}
        mode="category"
      />
      <Donut
        title="Por ativo"
        description="Os 5 maiores e o restante em Outros"
        slices={byAsset}
        mode="asset"
      />
    </div>
  );
}
