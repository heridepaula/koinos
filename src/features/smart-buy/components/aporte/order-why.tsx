"use client";

import { CalculatorIcon, SparklesIcon } from "lucide-react";
import type { RadarChip, RadarView, ThesisView } from "@/features/market-data";
import { ThesisPoints } from "@/features/market-data/ui";
import { CeilingCheckBody } from "@/features/strategy/ui";
import { GlossaryText } from "@/shared/components/glossary-text";
import { InsetGroup, InsetValueRow } from "@/shared/components/inset-list";
import { formatPercent, formatTradeDate } from "@/shared/lib/format";
import { glossaryEntry, glossaryIdsIn } from "@/shared/lib/glossary";
import type { MergedOrder } from "../../domain/merge-orders";
import type { OrderImpact } from "../../domain/aporte-impact";
import {
  calcSteps,
  calcSummary,
  plainReason,
  plainStockReason,
  stockCalcSteps,
  stockCalcSummary,
  type CalcStep,
} from "./explain";
import { ImpactList } from "./impact";
import type { AssetMeta } from "./orders";

const NO_THESIS = "A leitura da IA deste ativo ainda não foi gerada.";

const thesisNote = (date: Date) =>
  `Gerada por IA (Gemini) em ${formatTradeDate(date)} a partir dos sinais do método da sua Carteira Alvo e dos indicadores públicos. Pode conter erros e não é recomendação. Fonte: Fundamentus.`;

/** A linha 1 do "Por quê": a decisão do método em palavras. */
export const whyOf = (row: MergedOrder) =>
  row.kind === "FII" ? plainReason(row.order) : plainStockReason(row.order);

const stepsOf = (row: MergedOrder): CalcStep[] =>
  row.kind === "FII" ? calcSteps(row.order) : stockCalcSteps(row.order);
const summaryOf = (row: MergedOrder) =>
  row.kind === "FII" ? calcSummary(row.order) : stockCalcSummary(row.order);

const EFFECT_TEXT = { mais: "↑ compra mais", menos: "↓ compra menos" } as const;

/** Os termos do glossário da tese inteira, para "Termos deste texto" na folha. */
export function thesisTerms(radar: RadarView | undefined) {
  if (!radar?.thesis) return [];
  const text = [radar.thesis.verdict, ...radar.thesis.sentences].join(" ");
  return glossaryIdsIn(text, radar.kind).flatMap((id) => glossaryEntry(id) ?? []);
}

/** A célula fechada (dentro do botão da linha: nada interativo aqui). */
export function WhyCell({ row, thesis }: { row: MergedOrder; thesis: ThesisView | null }) {
  return (
    <span className="grid gap-0.5 text-left">
      <span className="text-footnote font-medium">{whyOf(row)}</span>
      {thesis ? (
        <span className="line-clamp-2 text-footnote text-muted-foreground">{thesis.verdict}</span>
      ) : null}
    </span>
  );
}

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

/** O corpo da leitura da IA: veredito, frases, pontos, indicadores e nota. */
function AiReadingBody({ radar }: { radar: RadarView }) {
  const { thesis } = radar;
  return (
    <div className="grid gap-3">
      {thesis ? (
        <>
          <p className="text-headline text-pretty">
            <GlossaryText text={thesis.verdict} assetClass={radar.kind} />
          </p>
          {thesis.sentences.map((sentence) => (
            <p key={sentence} className="text-subheadline text-pretty">
              <GlossaryText text={sentence} assetClass={radar.kind} />
            </p>
          ))}
          <ThesisPoints lenses={thesis.lenses} assetClass={radar.kind} />
        </>
      ) : (
        <p className="text-subheadline text-muted-foreground">{NO_THESIS}</p>
      )}
      {radar.chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {radar.chips.map((chip) => (
            <Chip key={chip.label} chip={chip} />
          ))}
        </div>
      ) : null}
      {thesis ? (
        <p className="text-footnote text-pretty text-muted-foreground">
          {thesisNote(thesis.generatedAt)}
        </p>
      ) : null}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof SparklesIcon; children: string }) {
  return (
    <p className="flex items-center gap-1.5 text-caption font-semibold tracking-wide text-muted-foreground uppercase">
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </p>
  );
}

/** Desktop: a coluna "Leitura da IA". */
export function AiReading({ radar }: { radar: RadarView }) {
  return (
    <section className="grid content-start gap-3" aria-label="Leitura da IA">
      <SectionTitle icon={SparklesIcon}>Leitura da IA</SectionTitle>
      <AiReadingBody radar={radar} />
    </section>
  );
}

/** Uma linha do cálculo: rótulo com glossário, valor e o efeito; o multiplicador no `title`. */
function StepRow({ step, kind }: { step: CalcStep; kind: MergedOrder["kind"] }) {
  return (
    <div className="flex justify-between gap-4" title={step.exact ?? undefined}>
      <dt className="text-muted-foreground">
        <GlossaryText text={step.label} assetClass={kind} methodTerms />
      </dt>
      <dd className="text-right tabular-nums">
        {step.value}
        {step.effect ? (
          <span className="block text-footnote text-muted-foreground">
            {EFFECT_TEXT[step.effect]}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

/** Desktop: a coluna "Cálculo do Koinos". */
export function KoinosCalc({
  row,
  info,
  impact,
}: {
  row: MergedOrder;
  info: AssetMeta | undefined;
  impact: OrderImpact | undefined;
}) {
  const { order } = row;
  return (
    <section className="grid content-start gap-4" aria-label="Cálculo do Koinos">
      <SectionTitle icon={CalculatorIcon}>Cálculo do Koinos</SectionTitle>
      <p className="text-subheadline text-pretty">{summaryOf(row)}</p>
      <dl className="grid gap-2 text-subheadline">
        {stepsOf(row).map((step) => (
          <StepRow key={step.label} step={step} kind={row.kind} />
        ))}
      </dl>
      <ImpactList
        impact={impact}
        weightBefore={order.weightBefore}
        weightAfter={order.weightAfter}
        targetWeight={order.targetWeight}
      />
      {info?.ceilingWarning ? (
        <div className="text-footnote">
          <CeilingCheckBody
            check={info.ceilingWarning.check}
            ceiling={info.ceilingWarning.ceiling}
            price={order.price}
          />
        </div>
      ) : null}
    </section>
  );
}

/** A linha expandida (desktop): a leitura da IA e o cálculo lado a lado a partir de 1.000 px. */
export function OrderDetail({
  row,
  info,
  impact,
}: {
  row: MergedOrder;
  info: AssetMeta | undefined;
  impact: OrderImpact | undefined;
}) {
  return (
    <div className="grid gap-6 py-2 motion-safe:animate-in motion-safe:fade-in-0 @min-[1000px]:grid-cols-[3fr_2fr]">
      {info?.radar ? (
        <AiReading radar={info.radar} />
      ) : (
        <p className="text-subheadline text-muted-foreground @min-[1000px]:col-span-2">
          {NO_THESIS}
        </p>
      )}
      <KoinosCalc row={row} info={info} impact={impact} />
    </div>
  );
}

/** Folha: "Por que este ativo". */
export function AiSheetGroup({ radar }: { radar: RadarView }) {
  return (
    <InsetGroup title="Por que este ativo">
      <div className="px-4 py-3">
        <AiReadingBody radar={radar} />
      </div>
    </InsetGroup>
  );
}

/** Folha: "Por que esta quantidade" (o cálculo e o peso antes, depois e meta). */
export function CalcSheetGroup({ row }: { row: MergedOrder }) {
  const { order } = row;
  return (
    <InsetGroup title="Por que esta quantidade">
      <p className="px-4 py-3 text-subheadline text-pretty">{summaryOf(row)}</p>
      {stepsOf(row).map((step) => (
        <InsetValueRow
          key={step.label}
          label={<GlossaryText text={step.label} assetClass={row.kind} methodTerms />}
          value={
            <span className="text-right">
              {step.value}
              {step.effect ? (
                <span className="block text-footnote">{EFFECT_TEXT[step.effect]}</span>
              ) : null}
            </span>
          }
        />
      ))}
      <InsetValueRow label="Peso antes" value={formatPercent(order.weightBefore, 1)} />
      <InsetValueRow label="Peso depois" value={formatPercent(order.weightAfter, 1)} />
      <InsetValueRow
        label={<GlossaryText text="Peso da meta" assetClass={row.kind} methodTerms />}
        value={formatPercent(order.targetWeight, 1)}
      />
    </InsetGroup>
  );
}
