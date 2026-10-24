"use client";

import dynamic from "next/dynamic";
import type { MonthlyContribution } from "@/features/transactions";
import { ChartPlaceholder } from "@/shared/components/chart-placeholder";
import { formatBRL } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

const PLOT_SIZE = "aspect-auto h-56 w-full md:h-72";

// O recharts fica fora do bundle inicial: chega depois da hidratação, no lugar da caixa vazia.
const ContributionsPlot = dynamic(
  () => import("./contributions-plot").then((mod) => mod.ContributionsPlot),
  { ssr: false, loading: () => <ChartPlaceholder className={PLOT_SIZE} /> },
);

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
        <ContributionsPlot data={data} className={PLOT_SIZE} />
      </CardContent>
    </Card>
  );
}
