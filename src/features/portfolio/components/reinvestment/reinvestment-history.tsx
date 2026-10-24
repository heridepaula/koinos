"use client";

import dynamic from "next/dynamic";
import { ChartPlaceholder } from "@/shared/components/chart-placeholder";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type { ReinvestmentView } from "../../domain/types";

const PLOT_SIZE = "aspect-auto h-56 w-full md:h-72";

// O recharts fica fora do bundle inicial: chega depois da hidratação, no lugar da caixa vazia.
const ReinvestmentPlot = dynamic(
  () => import("./reinvestment-plot").then((mod) => mod.ReinvestmentPlot),
  { ssr: false, loading: () => <ChartPlaceholder className={PLOT_SIZE} /> },
);

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
        <ReinvestmentPlot history={history} className={PLOT_SIZE} />
      </CardContent>
    </Card>
  );
}
