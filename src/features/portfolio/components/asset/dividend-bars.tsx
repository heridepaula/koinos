"use client";

import dynamic from "next/dynamic";
import { ChartPlaceholder } from "@/shared/components/chart-placeholder";
import type { DividendMonths } from "../../domain/asset-overview";

const PLOT_SIZE = "aspect-auto h-32 w-full";

// O recharts fica fora do bundle inicial, como nos outros gráficos.
const DividendBarsPlot = dynamic(
  () => import("./dividend-bars-plot").then((mod) => mod.DividendBarsPlot),
  { ssr: false, loading: () => <ChartPlaceholder className={PLOT_SIZE} /> },
);

/** As barras dos proventos dos 12 meses fechados, com a média do período tracejada. */
export function DividendBars({ months }: { months: DividendMonths }) {
  return <DividendBarsPlot months={months} className={PLOT_SIZE} />;
}
