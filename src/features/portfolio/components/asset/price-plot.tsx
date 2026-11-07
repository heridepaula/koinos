"use client";

import { CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { formatBRL, formatMonth } from "@/shared/lib/format";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/chart";
import { ChartTooltipRow } from "../chart-tooltip-row";

const config = { close: { label: "Fechamento", color: "var(--chart-1)" } } satisfies ChartConfig;

/** Fechamentos mensais do ativo, com o preço médio como referência. Carregado sob demanda. */
export function PricePlot({
  closes,
  averagePrice,
  className,
}: {
  closes: { month: string; close: number }[];
  averagePrice: number | null;
  className: string;
}) {
  return (
    <ChartContainer data-sensitive-axis="" config={config} className={className}>
      <ComposedChart data={closes} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonth}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          domain={["auto", "auto"]}
          tickFormatter={(value: number) => formatBRL(value)}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(month) => formatMonth(String(month))}
              formatter={(value) => (
                <ChartTooltipRow
                  color="var(--color-close)"
                  label="Fechamento"
                  value={formatBRL(Number(value))}
                />
              )}
            />
          }
        />
        {averagePrice !== null ? (
          <ReferenceLine
            y={averagePrice}
            stroke="var(--chart-2)"
            strokeDasharray="4 4"
            label={{ value: "Preço médio", position: "insideTopRight", fontSize: 12 }}
          />
        ) : null}
        <Line
          dataKey="close"
          type="monotone"
          stroke="var(--color-close)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
