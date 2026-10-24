"use client";

import dynamic from "next/dynamic";
import { ChartPlaceholder } from "@/shared/components/chart-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type { EvolutionPoint } from "../domain/types";

const PLOT_SIZE = "aspect-auto h-56 w-full md:h-72";

// O recharts fica fora do bundle inicial: chega depois da hidratação, no lugar da caixa vazia.
const EvolutionPlot = dynamic(() => import("./evolution-plot").then((mod) => mod.EvolutionPlot), {
  ssr: false,
  loading: () => <ChartPlaceholder className={PLOT_SIZE} />,
});

export function EvolutionChart({ points }: { points: EvolutionPoint[] }) {
  const estimatedMonths = points.filter((point) => point.estimated).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução do patrimônio</CardTitle>
        <CardDescription>Patrimônio × valor investido no fim de cada mês</CardDescription>
      </CardHeader>
      <CardContent>
        {points.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não há meses suficientes para o gráfico.
          </p>
        ) : (
          <EvolutionPlot points={points} className={PLOT_SIZE} />
        )}
        {estimatedMonths > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {estimatedMonths} meses usam o preço médio em algum ativo, por falta de fechamento
            histórico.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
