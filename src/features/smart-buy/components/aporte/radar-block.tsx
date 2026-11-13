"use client";

import { SparklesIcon } from "lucide-react";
import type { RadarChip, RadarView } from "@/features/market-data";
import { InsetGroup } from "@/shared/components/inset-list";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

export const RADAR_NOTE =
  "Texto gerado por IA (Gemini) a partir dos indicadores públicos. Pode conter erros e não é recomendação. Fonte: Fundamentus.";

/** Um indicador: a sigla e o valor; o toque abre a explicação em uma linha. */
function Chip({ chip }: { chip: RadarChip }) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-foreground/6 px-2 text-footnote tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11"
      >
        <span className="text-muted-foreground">{chip.label}</span>
        <span className="font-medium">{chip.value}</span>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-footnote">{chip.help}</PopoverContent>
    </Popover>
  );
}

function RadarBody({ radar }: { radar: RadarView }) {
  return (
    <div className="grid gap-3">
      {radar.chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {radar.chips.map((chip) => (
            <Chip key={chip.label} chip={chip} />
          ))}
        </div>
      ) : null}
      {radar.text ? <p className="text-subheadline text-pretty">{radar.text}</p> : null}
      {radar.text ? <p className="text-footnote text-muted-foreground">{RADAR_NOTE}</p> : null}
    </div>
  );
}

/** Tabela (desktop): o ✨ ao lado do ativo abre o Radar num popover. */
export function RadarPopover({ ticker, radar }: { ticker: string; radar: RadarView }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Radar de fundamentos de ${ticker}`}
            className="text-muted-foreground pointer-coarse:size-11"
          />
        }
      >
        <SparklesIcon aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <p className="flex items-center gap-1.5 text-headline">
          <SparklesIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          Radar de fundamentos
        </p>
        <RadarBody radar={radar} />
      </PopoverContent>
    </Popover>
  );
}

/** Sheet (iPhone): o Radar como um grupo, abaixo de "Depois desta ordem". */
export function RadarSheetGroup({ radar }: { radar: RadarView }) {
  return (
    <InsetGroup title="Radar de fundamentos">
      <div className="px-4 py-3">
        <RadarBody radar={radar} />
      </div>
    </InsetGroup>
  );
}
