"use client";

import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { formatBRL, formatCompactBRL, formatMonth } from "@/shared/lib/format";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/chart";
import type { EvolutionPoint } from "../domain/types";
import { ChartTooltipRow } from "./chart-tooltip-row";

const config = {
  patrimony: { label: "Patrimônio", color: "var(--chart-1)" },
  invested: { label: "Investido", color: "var(--chart-2)" },
} satisfies ChartConfig;

const activeDot = { r: 4, strokeWidth: 2, stroke: "var(--card)" };

/** O gráfico da evolução do patrimônio. Carregado sob demanda pelo `EvolutionChart`. */
export function EvolutionPlot({
  points,
  className,
}: {
  points: EvolutionPoint[];
  className: string;
}) {
  return (
    <ChartContainer config={config} className={className}>
      <ComposedChart data={points} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonth}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={(value: number) => formatCompactBRL(value)}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(month, payload) =>
                `${formatMonth(String(month))}${payload?.[0]?.payload?.estimated ? " · estimado" : ""}`
              }
              formatter={(value, name) => (
                <ChartTooltipRow
                  color={`var(--color-${name})`}
                  label={config[name as keyof typeof config]?.label ?? name}
                  value={formatBRL(Number(value))}
                />
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="patrimony"
          type="monotone"
          stroke="var(--color-patrimony)"
          strokeWidth={2}
          fill="var(--color-patrimony)"
          fillOpacity={0.12}
          dot={false}
          activeDot={activeDot}
        />
        <Line
          dataKey="invested"
          type="stepAfter"
          stroke="var(--color-invested)"
          strokeWidth={2}
          dot={false}
          activeDot={activeDot}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
