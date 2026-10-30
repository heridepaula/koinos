"use client";

import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatBRL, formatCompactBRL, formatMonth, formatSignedPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/chart";
import type { DividendsView } from "../../domain/types";
import { ChartTooltipRow } from "../chart-tooltip-row";
import { Sensitive } from "@/shared/components/sensitive";

// Uma série só: o título nomeia o gráfico, sem legenda. Cor validada contra o card nos dois temas.
const config = { amount: { label: "Proventos", color: "var(--chart-2)" } } satisfies ChartConfig;

/** Diferença para o mês anterior no tooltip: seta e valor em verde (subiu) ou vermelho (caiu). */
function MonthDelta({ amount, previous }: { amount: number; previous: number | undefined }) {
  if (previous === undefined) return null;
  const delta = amount - previous;
  if (Math.abs(delta) < 0.005) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        <MinusIcon className="size-3.5" aria-hidden />
        Igual ao mês anterior
      </div>
    );
  }
  const up = delta > 0;
  const Icon = up ? ArrowUpIcon : ArrowDownIcon;
  return (
    <div className={cn("flex items-center gap-1 tabular-nums", up ? "text-gain" : "text-loss")}>
      <Icon className="size-3.5" aria-hidden />
      <span>
        {up ? "+" : "−"}
        <Sensitive>{formatBRL(Math.abs(delta))}</Sensitive>
        {previous > 0 ? ` (${formatSignedPercent(delta / previous, 1)})` : null}
      </span>
      <span className="text-muted-foreground">vs. mês anterior</span>
    </div>
  );
}

/** O gráfico dos proventos por mês. Carregado sob demanda pelo `DividendsHistory`. */
export function DividendsPlot({
  chart,
  className,
}: {
  chart: DividendsView["chart"];
  className: string;
}) {
  // Os meses do gráfico são seguidos: o anterior de cada barra é a barra à esquerda.
  const previousAmount = new Map(
    chart.slice(1).map((point, index) => [point.month, chart[index].amount]),
  );
  return (
    <ChartContainer data-sensitive-axis="" config={config} className={className}>
      <BarChart data={chart} margin={{ left: 4, right: 12, top: 8 }}>
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
              formatter={(value, _name, item) => (
                <div className="grid w-full gap-1">
                  <ChartTooltipRow
                    color="var(--color-amount)"
                    label="Proventos"
                    value={<Sensitive>{formatBRL(Number(value))}</Sensitive>}
                  />
                  <MonthDelta
                    amount={Number(value)}
                    previous={previousAmount.get(String(item.payload?.month))}
                  />
                </div>
              )}
            />
          }
        />
        <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ChartContainer>
  );
}
