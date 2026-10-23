"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatBRL, formatCompactBRL, formatMonth, formatPercent } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/chart";
import type { ReinvestmentView } from "../../domain/types";
import { ChartTooltipRow } from "../chart-tooltip-row";

// Duas séries: bolso no azul dos aportes, proventos no laranja dos proventos (par validado nos
// dois temas, CVD ΔE > 24). Legenda sempre visível: a identidade não depende só da cor.
const config = {
  fromPocket: { label: "Bolso", color: "var(--chart-1)" },
  fromDividends: { label: "Proventos", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function ReinvestmentHistory({
  history,
  last12,
}: Pick<ReinvestmentView, "history" | "last12">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico</CardTitle>
        <CardDescription>
          {last12.share === null
            ? "Nenhum aporte nos últimos 12 meses."
            : `Nos últimos 12 meses, ${formatPercent(last12.share, 1)} dos aportes vieram de proventos (${formatBRL(last12.fromDividends)} de ${formatBRL(last12.aporte)}).`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-72 w-full">
          <BarChart data={history} margin={{ left: 4, right: 12, top: 8 }}>
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
                  labelFormatter={(month, payload) => {
                    const item = payload?.[0]?.payload as
                      ReinvestmentView["history"][number] | undefined;
                    const detail = item
                      ? ` · total ${formatBRL(item.aporte)} · ${formatPercent(item.percent / 100, 1)} reinvestido${item.isDefault ? " (padrão)" : ""}`
                      : "";
                    return `${formatMonth(String(month))}${detail}`;
                  }}
                  formatter={(value, name) => (
                    <ChartTooltipRow
                      color={`var(--color-${String(name)})`}
                      label={config[name as keyof typeof config]?.label ?? String(name)}
                      value={formatBRL(Number(value))}
                    />
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="fromPocket"
              stackId="aporte"
              fill="var(--color-fromPocket)"
              maxBarSize={24}
            />
            <Bar
              dataKey="fromDividends"
              stackId="aporte"
              fill="var(--color-fromDividends)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
