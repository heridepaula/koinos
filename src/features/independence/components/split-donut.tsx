"use client";

import { Pie, PieChart } from "recharts";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL } from "@/shared/lib/format";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/shared/ui/chart";

export type SplitSlice = { key: string; label: string; value: number; fill: string };

/** A rosca da meta: perpétua × temporária. Carregada sob demanda (o recharts é o maior pacote). */
export function SplitDonut({ data, className }: { data: SplitSlice[]; className: string }) {
  return (
    <ChartContainer config={{}} className={className}>
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, name) => (
                <span className="flex w-full justify-between gap-3">
                  <span className="text-muted-foreground">{name}</span>
                  <span className="font-medium tabular-nums">
                    <Sensitive>{formatBRL(Number(value))}</Sensitive>
                  </span>
                </span>
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
