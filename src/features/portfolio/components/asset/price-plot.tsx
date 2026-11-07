"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { formatBRL, formatMonth } from "@/shared/lib/format";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/chart";
import type { PricePoint } from "../../domain/asset-overview";
import { ChartTooltipRow } from "../chart-tooltip-row";
import { formatAxisBRL, formatDayKey, formatDayKeyLong } from "./price-format";

/**
 * A linha da cotação em segmentos retos (não inventa valores entre os fechamentos), com uma
 * lavagem da mesma cor que some para baixo. Carregado sob demanda pelo `PriceChart`.
 */
export function PricePlot({
  points,
  granularity,
  tone,
  domain,
  ticks,
  step,
  averagePrice,
  className,
}: {
  points: PricePoint[];
  granularity: "day" | "month";
  tone: "gain" | "loss";
  domain: [number, number];
  ticks: number[];
  step: number;
  /** Só quando cabe no eixo: fora dele, a legenda avisa. */
  averagePrice: number | null;
  className: string;
}) {
  const fillId = `price-fill-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const config = {
    close: { label: "Cotação", color: tone === "gain" ? "var(--gain)" : "var(--loss)" },
  } satisfies ChartConfig;
  const label = (key: string) => (granularity === "day" ? formatDayKeyLong(key) : formatMonth(key));

  return (
    <ChartContainer config={config} className={className}>
      <AreaChart data={points} margin={{ left: 4, right: 12, top: 8 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-close)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--color-close)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="key"
          tickFormatter={granularity === "day" ? formatDayKey : formatMonth}
          tickLine={false}
          axisLine={false}
          interval="equidistantPreserveStart"
          minTickGap={28}
        />
        <YAxis
          type="number"
          domain={domain}
          ticks={ticks}
          tickFormatter={(value: number) => formatAxisBRL(value, step)}
          tickLine={false}
          axisLine={false}
          width={step < 1 ? 72 : 64}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(key) => label(String(key))}
              formatter={(value) => (
                <ChartTooltipRow
                  color="var(--color-close)"
                  label="Cotação"
                  value={formatBRL(Number(value))}
                />
              )}
            />
          }
        />
        {averagePrice !== null ? (
          <ReferenceLine
            y={averagePrice}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
        ) : null}
        <Area
          dataKey="close"
          type="linear"
          stroke="var(--color-close)"
          strokeWidth={2}
          fill={`url(#${fillId})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          animationDuration={500}
        />
      </AreaChart>
    </ChartContainer>
  );
}
