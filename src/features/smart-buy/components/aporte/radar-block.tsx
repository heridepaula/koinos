"use client";

import { SparklesIcon } from "lucide-react";
import type { RadarChip, RadarView } from "@/features/market-data";
import { InsetGroup, InsetValueRow } from "@/shared/components/inset-list";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

export const RADAR_NOTE =
  "Texto gerado por IA (Gemini) a partir dos indicadores públicos. Pode conter erros e não é recomendação. Fonte: Fundamentus.";

/** Um indicador no popover: a sigla e o valor; a explicação aparece ao passar o mouse e vai aos leitores de tela. */
function Chip({ chip }: { chip: RadarChip }) {
  return (
    <span
      title={chip.help}
      className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-foreground/6 px-2 text-footnote tabular-nums"
    >
      <span className="text-muted-foreground">{chip.label}</span>
      <span className="font-medium">{chip.value}</span>
      <span className="sr-only">{`. ${chip.help}`}</span>
    </span>
  );
}

function RadarText({ radar }: { radar: RadarView }) {
  return radar.text ? (
    <>
      <p className="text-subheadline text-pretty">{radar.text}</p>
      <p className="text-footnote text-muted-foreground">{RADAR_NOTE}</p>
    </>
  ) : null;
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
        <div className="grid gap-3">
          {radar.chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {radar.chips.map((chip) => (
                <Chip key={chip.label} chip={chip} />
              ))}
            </div>
          ) : null}
          <RadarText radar={radar} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Sheet (iPhone): cada indicador com o valor e a explicação, sem popover dentro da folha. */
export function RadarSheetGroup({ radar }: { radar: RadarView }) {
  return (
    <InsetGroup title="Radar de fundamentos">
      {radar.chips.map((chip) => (
        <div key={chip.label} className="pb-3">
          <InsetValueRow label={chip.label} value={chip.value} />
          <p className="px-4 text-footnote text-muted-foreground">{chip.help}</p>
        </div>
      ))}
      {radar.text ? (
        <div className="grid gap-3 px-4 py-3">
          <RadarText radar={radar} />
        </div>
      ) : null}
    </InsetGroup>
  );
}
