"use client";

import dynamic from "next/dynamic";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { ChartPlaceholder } from "@/shared/components/chart-placeholder";
import { Delta } from "@/shared/components/delta";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatMonth, formatSignedPercent } from "@/shared/lib/format";
import { niceScale } from "@/shared/lib/nice-scale";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import {
  defaultPricePeriod,
  type PricePeriod,
  type PricePeriodId,
} from "../../domain/asset-overview";
import { formatDayKey } from "./price-format";

const PLOT_SIZE = "aspect-auto h-48 w-full md:h-60";
const PERIOD_IDS = ["1M", "6M", "1A", "5A", "TUDO"] as const satisfies readonly PricePeriodId[];

// O recharts fica fora do bundle inicial: chega depois da hidratação, no lugar da caixa vazia.
const PricePlot = dynamic(() => import("./price-plot").then((mod) => mod.PricePlot), {
  ssr: false,
  loading: () => <ChartPlaceholder className={PLOT_SIZE} />,
});

/**
 * O gráfico da cotação com a escolha do período (1M, 6M, 1A, 5A, Tudo: só os que têm dados). A
 * linha fica verde quando o período subiu e vermelha quando caiu, como no app Bolsa, e a variação
 * vem escrita ao lado, com o sinal. O preço médio da posição é a linha tracejada.
 */
export function PriceChart({
  ticker,
  periods,
  averagePrice,
}: {
  ticker: string;
  periods: PricePeriod[];
  averagePrice: number | null;
}) {
  const [chosen, setChosen] = useQueryState(
    "periodo",
    parseAsStringLiteral(PERIOD_IDS).withOptions({ history: "replace" }),
  );
  const period = periods.find((item) => item.id === chosen) ?? defaultPricePeriod(periods);
  if (!period) return null;

  const closes = period.points.map((point) => point.close);
  // O preço médio entra no eixo quando está perto da faixa do período (até 15% fora dela), com
  // meio passo de folga embaixo para não colar na base; longe, a legenda diz para que lado ficou.
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  const near = averagePrice !== null && averagePrice >= low * 0.85 && averagePrice <= high * 1.15;
  let scale = niceScale(near ? [...closes, averagePrice] : closes);
  if (near && averagePrice - scale.domain[0] < scale.step / 2) {
    scale = niceScale([...closes, averagePrice, scale.domain[0] - scale.step / 2]);
  }
  const first = period.points[0];
  const last = period.points[period.points.length - 1];
  const since = period.granularity === "day" ? formatDayKey(first.key) : formatMonth(first.key);
  const tone = (period.change ?? 0) < 0 ? "loss" : "gain";
  const averageShown =
    averagePrice !== null && averagePrice >= scale.domain[0] && averagePrice <= scale.domain[1];
  const summary =
    `Cotação de ${ticker} desde ${since}: de ${formatBRL(first.close)} para ` +
    `${formatBRL(last.close)}${period.change === null ? "" : ` (${formatSignedPercent(period.change)})`}.`;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {periods.length > 1 ? (
          <SegmentedControl
            size="sm"
            label="Período do gráfico"
            value={period.id}
            onChange={(value) => void setChosen(value)}
            options={periods.map((item) => ({ value: item.id, label: item.label }))}
            className="max-[479px]:w-full"
          />
        ) : null}
        {period.change !== null ? (
          <p className="flex items-center gap-1.5 text-footnote">
            <Delta pct={period.change} className="font-semibold" />
            <span className="text-muted-foreground">desde {since}</span>
          </p>
        ) : null}
      </div>
      <div role="img" aria-label={summary}>
        <PricePlot
          points={period.points}
          granularity={period.granularity}
          tone={tone}
          domain={scale.domain}
          ticks={scale.ticks}
          step={scale.step}
          averagePrice={averageShown ? averagePrice : null}
          className={PLOT_SIZE}
        />
      </div>
      {averagePrice !== null ? (
        <p className="flex items-center gap-2 text-footnote text-muted-foreground">
          <svg aria-hidden="true" width="18" height="2" className="shrink-0 overflow-visible">
            <line
              x1="0"
              y1="1"
              x2="18"
              y2="1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          </svg>
          <span>
            Seu preço médio, <Sensitive>{formatBRL(averagePrice)}</Sensitive>
            {averageShown
              ? null
              : averagePrice < scale.domain[0]
                ? " (abaixo do gráfico)"
                : " (acima do gráfico)"}
          </span>
        </p>
      ) : null}
    </div>
  );
}
