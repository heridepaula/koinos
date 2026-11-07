"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatCompactBRL, formatMonth } from "@/shared/lib/format";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/chart";
import type { DividendMonths } from "../../domain/asset-overview";
import { ChartTooltipRow } from "../chart-tooltip-row";
import { formatMonthShort } from "./price-format";

const config = { amount: { label: "Proventos", color: "var(--chart-2)" } } satisfies ChartConfig;

/**
 * Colunas de 24 px no máximo, com o topo arredondado e a base reta; mês sem provento fica sem
 * barra. Os meses em "nov/25", e o eixo pula os que não cabem. Carregado sob demanda pelo
 * `DividendBars`.
 */
export function DividendBarsPlot({
  months,
  className,
}: {
  months: DividendMonths;
  className: string;
}) {
  return (
    <ChartContainer data-sensitive-axis="" config={config} className={className}>
      <BarChart data={months.months} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonthShort}
          tickLine={false}
          axisLine={false}
          interval="equidistantPreserveStart"
          minTickGap={12}
        />
        <YAxis
          tickFormatter={(value: number) => formatCompactBRL(value)}
          tickLine={false}
          axisLine={false}
          width={64}
          tickCount={3}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(month) => formatMonth(String(month))}
              formatter={(value) => (
                <ChartTooltipRow
                  color="var(--color-amount)"
                  label="Proventos"
                  value={<Sensitive>{formatBRL(Number(value))}</Sensitive>}
                />
              )}
            />
          }
        />
        {months.monthlyAverage > 0 ? (
          <ReferenceLine
            y={months.monthlyAverage}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
        ) : null}
        <Bar
          dataKey="amount"
          fill="var(--color-amount)"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
          animationDuration={500}
        />
      </BarChart>
    </ChartContainer>
  );
}
