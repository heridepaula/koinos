"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalculatorIcon,
  ChevronRightIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { RadarChip, RadarView, ThesisView } from "@/features/market-data";
import { ThesisPoints } from "@/features/market-data/ui";
import { ceilingCheckDetails, type CeilingCheck } from "@/features/strategy";
import { CeilingCheckIcon } from "@/features/strategy/ui";
import { GlossaryText } from "@/shared/components/glossary-text";
import { InsetGroup, InsetValueRow } from "@/shared/components/inset-list";
import { QUANTITY_MASK, Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatPercent, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { glossaryEntry, glossaryIdsIn } from "@/shared/lib/glossary";
import type { MergedOrder } from "../../domain/merge-orders";
import type { OrderImpact } from "../../domain/aporte-impact";
import {
  calcFlow,
  calcSteps,
  plainReason,
  plainStockReason,
  stockCalcFlow,
  stockCalcSteps,
  type CalcFlow,
  type CalcStep,
} from "./explain";
import { ImpactList } from "./impact";
import type { AssetMeta } from "./orders";

// O "Por quê" de uma ordem (spec por-que-na-tabela §7 e §8): a linha da tabela, a linha expandida
// em três colunas (leitura da IA, por que esta quantidade, depois desta ordem) e a folha do celular.

const NO_THESIS = "A leitura da IA deste ativo ainda não foi gerada.";

/** A nota da IA numa linha: quem gerou, quando, o aviso e a fonte. */
const thesisNote = (date: Date) =>
  `Gerado por IA (Gemini) em ${formatTradeDate(date)} · pode conter erros e não é recomendação · Fonte: Fundamentus`;

/** O rótulo do fator de P/VP: quando ele aparece no cálculo, o chip de P/VP sai da leitura. */
const PVP_STEP = "Preço sobre o patrimônio";

/** A linha 1 do "Por quê": a decisão do método em palavras. */
export const whyOf = (row: MergedOrder) =>
  row.kind === "FII" ? plainReason(row.order) : plainStockReason(row.order);

const stepsOf = (row: MergedOrder): CalcStep[] =>
  row.kind === "FII" ? calcSteps(row.order) : stockCalcSteps(row.order);
const flowOf = (row: MergedOrder): CalcFlow =>
  row.kind === "FII" ? calcFlow(row.order) : stockCalcFlow(row.order);

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** A trava e a sobra numa frase curta, embaixo do fluxo. */
function flowFootnote(flow: CalcFlow): string | null {
  const limit =
    flow.limit === null
      ? null
      : flow.limit === "o saldo acabou"
        ? "O saldo do aporte acabou antes do pedido."
        : `Cortado pelo ${flow.limit}.`;
  const note = flow.note ? `${capitalize(flow.note)}.` : null;
  return [limit, note].filter(Boolean).join(" ") || null;
}

/** Os termos do glossário da tese inteira (veredito, frases e lentes), para "Termos deste texto". */
export function thesisTerms(radar: RadarView | undefined) {
  if (!radar?.thesis) return [];
  const text = [
    radar.thesis.verdict,
    ...radar.thesis.sentences,
    ...radar.thesis.lenses.map((lens) => lens.text),
  ].join(" ");
  return glossaryIdsIn(text, radar.kind).flatMap((id) => glossaryEntry(id) ?? []);
}

/**
 * A célula do "Por quê" (dentro do botão da linha: nada interativo aqui). Com a linha aberta, o
 * veredito sai daqui: ele está logo abaixo, na leitura da IA.
 */
export function WhyCell({
  row,
  thesis,
  open = false,
}: {
  row: MergedOrder;
  thesis: ThesisView | null;
  open?: boolean;
}) {
  return (
    <span className="grid gap-0.5 text-left">
      <span className="text-footnote font-medium">{whyOf(row)}</span>
      {thesis && !open ? (
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

/** O corpo da leitura da IA: veredito, frases, pontos e indicadores (sem os que o cálculo já mostra). */
function AiReadingBody({
  radar,
  hideChips = [],
}: {
  radar: RadarView;
  hideChips?: readonly string[];
}) {
  const { thesis } = radar;
  const chips = radar.chips.filter((chip) => !hideChips.includes(chip.label));
  return (
    <div className="grid gap-3">
      {thesis ? (
        <>
          <p className="text-headline text-pretty">
            <GlossaryText text={thesis.verdict} assetClass={radar.kind} />
          </p>
          {thesis.sentences.map((sentence, index) => (
            <p key={`${index}-${sentence}`} className="text-subheadline text-pretty">
              <GlossaryText text={sentence} assetClass={radar.kind} />
            </p>
          ))}
          <ThesisPoints lenses={thesis.lenses} assetClass={radar.kind} />
        </>
      ) : (
        <p className="text-subheadline text-muted-foreground">{NO_THESIS}</p>
      )}
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Chip key={chip.label} chip={chip} />
          ))}
        </div>
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

/** Um número do fluxo: o rótulo pequeno em cima e o valor (da carteira, some na privacidade). */
function FlowCell({
  label,
  value,
  detail,
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="grid content-start gap-0.5">
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className="text-headline tabular-nums">{value}</span>
      {detail ? (
        <span className="text-caption text-muted-foreground tabular-nums">{detail}</span>
      ) : null}
    </div>
  );
}

const FlowArrow = () => (
  <ChevronRightIcon className="mt-5 size-4 text-muted-foreground" aria-hidden="true" />
);

/** Faltava → pediu → comprou (ações: faltava → comprou), com a trava e a sobra embaixo. */
function FlowView({ flow, kind }: { flow: CalcFlow; kind: MergedOrder["kind"] }) {
  const footnote = flowFootnote(flow);
  const bought = (
    <FlowCell
      label="Comprou"
      value={<Sensitive>{formatBRL(flow.total)}</Sensitive>}
      detail={
        <>
          <Sensitive mask={QUANTITY_MASK}>{formatQuantity(flow.quantity)}</Sensitive> {flow.unit}
        </>
      }
    />
  );
  return (
    <div className="grid gap-2">
      <div
        className={
          flow.need === null
            ? "grid grid-cols-[1fr_auto_1fr] gap-x-2"
            : "grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-x-2"
        }
      >
        <FlowCell
          label={<GlossaryText text="Faltava para a meta" assetClass={kind} methodTerms />}
          value={flow.gap === null ? "já na meta" : <Sensitive>{formatBRL(flow.gap)}</Sensitive>}
        />
        <FlowArrow />
        {flow.need === null ? null : (
          <>
            <FlowCell
              label="O método pediu"
              value={<Sensitive>{formatBRL(flow.need)}</Sensitive>}
            />
            <FlowArrow />
          </>
        )}
        {bought}
      </div>
      {footnote ? <p className="text-footnote text-muted-foreground">{footnote}</p> : null}
    </div>
  );
}

/** Um fator: a seta (verde aumenta a compra, vermelha reduz), o rótulo e o valor. */
function FactorRow({ step, kind }: { step: CalcStep; kind: MergedOrder["kind"] }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="flex items-baseline gap-1.5 text-muted-foreground">
        {step.effect === "mais" ? (
          <ArrowUpIcon className="size-3.5 shrink-0 self-center text-gain" aria-hidden="true" />
        ) : step.effect === "menos" ? (
          <ArrowDownIcon className="size-3.5 shrink-0 self-center text-loss" aria-hidden="true" />
        ) : (
          <span className="w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span>
          <GlossaryText text={step.label} assetClass={kind} methodTerms />
          {step.effect ? (
            <span className="sr-only">
              {step.effect === "mais" ? ", aumenta a compra" : ", reduz a compra"}
            </span>
          ) : null}
        </span>
      </dt>
      <dd className="text-right tabular-nums" title={step.exact ?? undefined}>
        {step.value}
      </dd>
    </div>
  );
}

/** O aviso do teto numa linha: o ícone (o texto completo no tooltip dele), o teto e a diferença. */
function CeilingLine({
  check,
  ceiling,
  price,
}: {
  check: CeilingCheck;
  ceiling: number;
  price: number;
}) {
  const details = ceilingCheckDetails(check, ceiling, price);
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-footnote">
      <CeilingCheckIcon check={check} ceiling={ceiling} price={price} />
      <span>
        Teto calculado <span className="font-medium">{formatBRL(check.calculated)}</span>
      </span>
      <span className="text-muted-foreground">· {details.change} em relação ao do ranking</span>
    </p>
  );
}

/**
 * A linha expandida (desktop): três colunas de altura parecida (a leitura da IA mais larga), duas
 * abaixo de 1.100 px de card, e a nota da IA numa faixa de rodapé.
 */
export function OrderDetail({
  row,
  info,
  impact,
}: {
  row: MergedOrder;
  info: AssetMeta | undefined;
  impact: OrderImpact | undefined;
}) {
  const steps = stepsOf(row);
  const thesis = info?.radar?.thesis ?? null;
  const hideChips = steps.some((step) => step.label === PVP_STEP) ? ["P/VP"] : [];
  return (
    <div className="grid gap-x-10 gap-y-6 py-2 motion-safe:animate-in motion-safe:fade-in-0 @min-[700px]:grid-cols-2 @min-[1100px]:grid-cols-[1.4fr_1fr_1fr]">
      <section className="grid content-start gap-3" aria-label="Leitura da IA">
        <SectionTitle icon={SparklesIcon}>Leitura da IA</SectionTitle>
        {info?.radar ? (
          <AiReadingBody radar={info.radar} hideChips={hideChips} />
        ) : (
          <p className="text-subheadline text-muted-foreground">{NO_THESIS}</p>
        )}
      </section>
      <section className="grid content-start gap-4" aria-label="Por que esta quantidade">
        <SectionTitle icon={CalculatorIcon}>Por que esta quantidade</SectionTitle>
        <FlowView flow={flowOf(row)} kind={row.kind} />
        {steps.length > 0 ? (
          <dl className="grid gap-2 text-subheadline">
            {steps.map((step) => (
              <FactorRow key={step.label} step={step} kind={row.kind} />
            ))}
          </dl>
        ) : null}
      </section>
      {impact || info?.ceilingWarning ? (
        <section className="grid content-start gap-4" aria-label="Depois desta ordem">
          <SectionTitle icon={TrendingUpIcon}>Depois desta ordem</SectionTitle>
          {impact ? <ImpactList impact={impact} /> : null}
          {info?.ceilingWarning ? (
            <CeilingLine
              check={info.ceilingWarning.check}
              ceiling={info.ceilingWarning.ceiling}
              price={row.order.price}
            />
          ) : null}
        </section>
      ) : null}
      {thesis ? (
        <p className="col-span-full flex items-center gap-1.5 border-t pt-3 text-footnote text-muted-foreground">
          <SparklesIcon className="size-3.5 shrink-0" aria-hidden="true" />
          {thesisNote(thesis.generatedAt)}
        </p>
      ) : null}
    </div>
  );
}

/** Folha: "Por que este ativo". */
export function AiSheetGroup({ radar }: { radar: RadarView }) {
  return (
    <InsetGroup
      title="Por que este ativo"
      footer={radar.thesis ? thesisNote(radar.thesis.generatedAt) : undefined}
    >
      <div className="px-4 py-3">
        <AiReadingBody radar={radar} />
      </div>
    </InsetGroup>
  );
}

/** Folha: "Por que esta quantidade": o fluxo em linhas, os fatores e o peso (a lista não tem as colunas). */
export function CalcSheetGroup({ row }: { row: MergedOrder }) {
  const { order } = row;
  const flow = flowOf(row);
  return (
    <InsetGroup title="Por que esta quantidade" footer={flowFootnote(flow) ?? undefined}>
      <InsetValueRow
        label={<GlossaryText text="Faltava para a meta" assetClass={row.kind} methodTerms />}
        value={flow.gap === null ? "já na meta" : <Sensitive>{formatBRL(flow.gap)}</Sensitive>}
      />
      {flow.need === null ? null : (
        <InsetValueRow
          label="O método pediu"
          value={<Sensitive>{formatBRL(flow.need)}</Sensitive>}
        />
      )}
      {stepsOf(row).map((step) => (
        <InsetValueRow
          key={step.label}
          label={
            <span className="inline-flex items-baseline gap-1.5">
              {step.effect === "mais" ? (
                <ArrowUpIcon className="size-3.5 self-center text-gain" aria-hidden="true" />
              ) : step.effect === "menos" ? (
                <ArrowDownIcon className="size-3.5 self-center text-loss" aria-hidden="true" />
              ) : null}
              <GlossaryText text={step.label} assetClass={row.kind} methodTerms />
            </span>
          }
          value={step.value}
        />
      ))}
      <InsetValueRow
        label="Peso antes ➔ depois"
        value={`${formatPercent(order.weightBefore, 1)} ➔ ${formatPercent(order.weightAfter, 1)}`}
      />
      <InsetValueRow
        label={<GlossaryText text="Peso da meta" assetClass={row.kind} methodTerms />}
        value={formatPercent(order.targetWeight, 1)}
      />
    </InsetGroup>
  );
}
