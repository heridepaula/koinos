"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ChartPlaceholder } from "@/shared/components/chart-placeholder";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { OTHERS_KEY, UNCATEGORIZED_KEY } from "../domain/allocation";
import type { AllocationSlice } from "../domain/types";

// A cor segue a entidade: cada categoria tem sempre o mesmo slot da paleta.
const CATEGORY_SLOT: Record<string, number> = {
  FII_TIJOLO: 1,
  FII_PAPEL: 2,
  FII_HIBRIDO: 3,
  FII_FOF: 4,
  FIAGRO: 5,
  ACAO: 6,
  ETF: 7,
  OUTRO: 8,
};
const NEUTRAL = "var(--muted-foreground)";

const DONUT_SIZE = "mx-auto aspect-square w-full max-w-48";

// O recharts fica fora do bundle inicial: chega depois da hidratação, no lugar da caixa vazia.
const AllocationDonut = dynamic(
  () => import("./allocation-donut").then((mod) => mod.AllocationDonut),
  { ssr: false, loading: () => <ChartPlaceholder className={DONUT_SIZE} /> },
);

type Mode = "category" | "asset";

function colorFor(slice: AllocationSlice, index: number, mode: Mode): string {
  if (slice.key === OTHERS_KEY || slice.key === UNCATEGORIZED_KEY) return NEUTRAL;
  const slot = mode === "category" ? CATEGORY_SLOT[slice.key] : index + 1;
  return slot ? `var(--chart-${slot})` : NEUTRAL;
}

const MODE_OPTIONS = [
  { value: "category", label: "Categoria" },
  { value: "asset", label: "Ativo" },
] as const;

function Donut({
  title,
  description,
  slices,
  mode,
  shown,
  onShow,
}: {
  title: string;
  description: string;
  slices: AllocationSlice[];
  mode: Mode;
  /** No iPhone, os dois donuts dividem um card: só o escolhido aparece. */
  shown: Mode;
  onShow: (mode: Mode) => void;
}) {
  const data = slices.map((slice, index) => ({ ...slice, fill: colorFor(slice, index, mode) }));
  return (
    <Card className={cn(mode !== shown && "max-md:hidden")}>
      <CardHeader>
        <CardTitle>
          <span className="md:hidden">Alocação</span>
          <span className="max-md:hidden">{title}</span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        <SegmentedControl
          label="Alocação por"
          value={shown}
          options={MODE_OPTIONS}
          onChange={onShow}
          className="mt-2 w-full md:hidden"
        />
      </CardHeader>
      <CardContent className="grid items-center gap-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
        <AllocationDonut data={data} className={DONUT_SIZE} />
        {/* Legenda com valores visíveis: a identidade nunca depende só da cor. */}
        <ul className="grid gap-1.5 text-sm">
          {data.map((slice) => (
            <li key={slice.key} className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ background: slice.fill }}
              />
              <span className="truncate">{slice.label}</span>
              <span className="ml-auto text-muted-foreground tabular-nums">
                {formatPercent(slice.share, 1)}
              </span>
              <span className="w-28 text-right tabular-nums">{formatBRL(slice.value)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * Alocação por categoria e por ativo: dois cards lado a lado na mesa; no iPhone, um card só, com
 * um controle segmentado escolhendo o donut (metade da rolagem).
 */
export function AllocationCharts({
  byCategory,
  byAsset,
}: {
  byCategory: AllocationSlice[];
  byAsset: AllocationSlice[];
}) {
  const [shown, setShown] = useState<Mode>("category");
  return (
    <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
      <Donut
        title="Por categoria"
        description="Defina as categorias na Carteira Alvo"
        slices={byCategory}
        mode="category"
        shown={shown}
        onShow={setShown}
      />
      <Donut
        title="Por ativo"
        description="Os 5 maiores e o restante em Outros"
        slices={byAsset}
        mode="asset"
        shown={shown}
        onShow={setShown}
      />
    </div>
  );
}
