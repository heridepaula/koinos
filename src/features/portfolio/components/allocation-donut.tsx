"use client";

import { Pie, PieChart } from "recharts";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/shared/ui/chart";
import type { AllocationSlice } from "../domain/types";
import { ChartTooltipRow } from "./chart-tooltip-row";

/** O donut da alocação, com a cor de cada fatia já escolhida. Carregado sob demanda. */
export function AllocationDonut({
  data,
  className,
}: {
  data: (AllocationSlice & { fill: string })[];
  className: string;
}) {
  return (
    <ChartContainer config={{}} className={className}>
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, name, item) => (
                <ChartTooltipRow
                  color={String(item.payload?.fill)}
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
  );
}
