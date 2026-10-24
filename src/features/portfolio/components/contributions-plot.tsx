"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { MonthlyContribution } from "@/features/transactions";
import { formatBRL, formatCompactBRL, formatMonth } from "@/shared/lib/format";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/chart";
import { ChartTooltipRow } from "./chart-tooltip-row";

const config = { amount: { label: "Aporte", color: "var(--chart-1)" } } satisfies ChartConfig;

/** O gráfico dos aportes por mês. Carregado sob demanda pelo `ContributionsChart`. */
export function ContributionsPlot({
  data,
  className,
}: {
  data: MonthlyContribution[];
  className: string;
}) {
  return (
    <ChartContainer config={config} className={className}>
      <BarChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonth}
          tickLine={false}
          axisLine={false}
          minTickGap={16}
        />
        <YAxis
          tickFormatter={(value: number) => formatCompactBRL(value)}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(month) => formatMonth(String(month))}
              formatter={(value) => (
                <ChartTooltipRow
                  color="var(--color-amount)"
                  label="Aporte"
                  value={formatBRL(Number(value))}
                />
              )}
            />
          }
        />
        <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ChartContainer>
  );
}
