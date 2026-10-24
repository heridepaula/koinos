"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { MonthlyContribution } from "@/features/transactions";
import { formatBRL, formatCompactBRL, formatMonth } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/chart";
import { ChartTooltipRow } from "./chart-tooltip-row";

const config = { amount: { label: "Aporte", color: "var(--chart-1)" } } satisfies ChartConfig;

/** Regularidade dos aportes: o patrimônio se constrói aportando todo mês. */
export function ContributionsChart({ data }: { data: MonthlyContribution[] }) {
  const monthsWithAporte = data.filter((month) => month.amount > 0).length;
  const total = data.reduce((sum, month) => sum + month.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aportes por mês</CardTitle>
        <CardDescription>
          {monthsWithAporte} de {data.length} meses com aporte · média de{" "}
          {formatBRL(data.length > 0 ? total / data.length : 0)} por mês
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-56 w-full md:h-72">
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
            <Bar
              dataKey="amount"
              fill="var(--color-amount)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
