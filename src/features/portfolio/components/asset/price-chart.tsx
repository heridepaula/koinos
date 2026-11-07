"use client";

import dynamic from "next/dynamic";
import { ChartPlaceholder } from "@/shared/components/chart-placeholder";

const PLOT_SIZE = "aspect-auto h-56 w-full md:h-72";

// O recharts fica fora do bundle inicial: chega depois da hidratação, no lugar da caixa vazia.
const PricePlot = dynamic(() => import("./price-plot").then((mod) => mod.PricePlot), {
  ssr: false,
  loading: () => <ChartPlaceholder className={PLOT_SIZE} />,
});

export function PriceChart({
  closes,
  averagePrice,
}: {
  closes: { month: string; close: number }[];
  averagePrice: number | null;
}) {
  if (closes.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Ainda não há fechamentos mensais guardados para este ativo.
      </p>
    );
  }
  return <PricePlot closes={closes} averagePrice={averagePrice} className={PLOT_SIZE} />;
}
