"use client";

import { SparklesIcon } from "lucide-react";
import type { RadarChip, RadarView, ThesisView } from "@/features/market-data";
import { CouncilLenses } from "@/features/market-data/ui";
import { GlossaryText } from "@/shared/components/glossary-text";
import { InsetGroup, InsetValueRow } from "@/shared/components/inset-list";
import { formatTradeDate } from "@/shared/lib/format";
import { glossaryEntry, glossaryIdsIn } from "@/shared/lib/glossary";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

const thesisNote = (date: Date) =>
  `Texto gerado por IA (Gemini) em ${formatTradeDate(date)} a partir dos sinais do método da sua Carteira Alvo e dos indicadores públicos. Pode conter erros e não é recomendação. Fonte: Fundamentus.`;

const fullText = (thesis: ThesisView) => [thesis.verdict, ...thesis.sentences].join(" ");

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

/** O veredito em destaque, as outras frases e as lentes; a nota fica com quem chama. */
function ThesisBody({ thesis, kind }: { thesis: ThesisView; kind: RadarView["kind"] }) {
  return (
    <div className="grid gap-2">
      <p className="text-headline text-pretty">
        <GlossaryText text={thesis.verdict} assetClass={kind} />
      </p>
      {thesis.sentences.map((sentence) => (
        <p key={sentence} className="text-subheadline text-pretty">
          <GlossaryText text={sentence} assetClass={kind} />
        </p>
      ))}
      <CouncilLenses lenses={thesis.lenses} assetClass={kind} />
    </div>
  );
}

/** Tabela (desktop): o ✨ ao lado do ativo abre a tese num popover. */
export function RadarPopover({
  ticker,
  radar,
  reason,
}: {
  ticker: string;
  radar: RadarView;
  /** O porquê deste aporte, do código (`shortReason`/`shortStockReason`). */
  reason: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Por que comprar ${ticker}: tese e indicadores`}
            className="text-muted-foreground pointer-coarse:size-11"
          />
        }
      >
        <SparklesIcon aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-88">
        <p className="flex items-center gap-1.5 text-headline">
          <SparklesIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          Por que este ativo
        </p>
        <div className="grid gap-4">
          <div className="grid gap-0.5">
            <p className="text-footnote text-muted-foreground">Neste aporte</p>
            <p className="text-subheadline">{reason}</p>
          </div>
          {radar.thesis ? <ThesisBody thesis={radar.thesis} kind={radar.kind} /> : null}
          {radar.chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {radar.chips.map((chip) => (
                <Chip key={chip.label} chip={chip} />
              ))}
            </div>
          ) : null}
          {radar.thesis ? (
            <p className="text-footnote text-muted-foreground">
              {thesisNote(radar.thesis.generatedAt)}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Sheet (iPhone): a tese, cada indicador com o valor e a explicação, e os termos do texto.
 * A folha já tem "Por quê" com a conta do código logo acima, por isso não repete "Neste aporte".
 */
export function RadarSheetGroup({ radar }: { radar: RadarView }) {
  const terms = radar.thesis
    ? glossaryIdsIn(fullText(radar.thesis), radar.kind).flatMap((id) => glossaryEntry(id) ?? [])
    : [];
  return (
    <InsetGroup title="Por que este ativo">
      {radar.thesis ? (
        <div className="grid gap-3 px-4 py-3">
          <ThesisBody thesis={radar.thesis} kind={radar.kind} />
          <p className="text-footnote text-muted-foreground">
            {thesisNote(radar.thesis.generatedAt)}
          </p>
        </div>
      ) : null}
      {radar.chips.map((chip) => (
        <div key={chip.label} className="pb-3">
          <InsetValueRow label={chip.label} value={chip.value} />
          <p className="px-4 text-footnote text-muted-foreground">{chip.help}</p>
        </div>
      ))}
      {terms.length > 0 ? (
        <>
          <p className="px-4 pt-2 text-footnote font-medium text-muted-foreground">
            Termos deste texto
          </p>
          {terms.map((entry) => (
            <div key={entry.id} className="grid gap-0.5 px-4 py-2">
              <p className="text-subheadline font-medium">{entry.term}</p>
              <p className="text-footnote text-muted-foreground">{entry.definition}</p>
            </div>
          ))}
        </>
      ) : null}
    </InsetGroup>
  );
}
