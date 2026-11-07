import type { ReactNode } from "react";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import {
  CONTINGENCY_SHARE,
  EDUCATION_INFLATION,
  GENERAL_INFLATION,
  REINVESTMENT_SHARE,
} from "../domain/constants";
import type { IndependenceSummary } from "../domain/types";
import { CostHelp } from "./cost-help";
import { yieldLabel, type VerdictTone } from "./format";

// Peças pequenas da página e da revisão do questionário: a barra dividida, o selo da previsão e a
// rentabilidade mensal da meta.

export type SplitPart = { key: string; label: string; value: number; color: string };

/**
 * Barra dividida em trechos proporcionais, como a composição do patrimônio no Dashboard. É
 * decorativa: a legenda ao lado diz os valores (a identidade nunca depende só da cor).
 */
export function SplitBar({ parts, className }: { parts: SplitPart[]; className?: string }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  if (total <= 0) return null;
  return (
    <div
      aria-hidden="true"
      className={cn("flex h-2.5 gap-0.5 overflow-hidden rounded-full", className)}
    >
      {parts
        .filter((part) => part.value > 0)
        .map((part) => (
          <span
            key={part.key}
            className="h-full min-w-1"
            style={{ flex: `${part.value / total} 1 0`, background: part.color }}
          />
        ))}
    </div>
  );
}

/** Bolinha da cor de um trecho, para a legenda. */
export function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}

/** Selo da previsão contra a idade alvo, com o tom do veredito (verde, âmbar ou neutro). */
export function VerdictChip({ tone, children }: { tone: VerdictTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-footnote font-semibold",
        tone === "gain" && "bg-gain/6 text-gain dark:bg-gain/8",
        tone === "warn" && "bg-warn/8 text-warn dark:bg-warn/10",
        tone === "neutral" && "bg-muted text-muted-foreground",
      )}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

const COST_HELP: Record<string, string> = {
  essential:
    "Gasto fixo de todo mês, corrigido pela inflação, com 30% a mais de folga para imprevistos. Ex.: aluguel ou condomínio, luz, água, internet, mercado, transporte e cartões.",
  seasonal:
    "Despesas que vêm uma ou poucas vezes por ano, divididas por 12 para virar um valor mensal. Ex.: IPVA, IPTU, seguro do carro e da casa, manutenção.",
  travel:
    "Viagens e lazer extra, que não são do dia a dia, divididos por 12. Ex.: férias, passagens, hospedagem, passeios.",
  health:
    "Mensalidade do plano de saúde do titular e do cônjuge na idade alvo, pela faixa de idade e pelo nível escolhido. Sobe quando muda de faixa.",
  education:
    "Escola, cursos e van de todos os dependentes, por mês. Ex.: mensalidade escolar, inglês, natação, transporte escolar. Só conta enquanto forem custeados.",
  childrenHealth:
    "Plano de saúde dos dependentes: quantidade de dependentes × a mensalidade da faixa do mais novo. Só conta enquanto forem custeados.",
};

/** As duas partes do que a meta recebe: azul volta para a carteira (como um aporte), laranja é renda. */
const YIELD_COLORS = { reinvest: "var(--chart-1)", income: "var(--chart-2)" } as const;

/**
 * O que a meta recebe por mês no usufruto (spec v2 §2.7), dividido pela regra dos 24%: 24%
 * reinvestidos para repor a inflação e o resto para viver.
 */
export function YieldSplit({
  summary,
  headingLevel: Heading = "h3",
}: {
  summary: IndependenceSummary;
  headingLevel?: "h2" | "h3";
}) {
  const parts = [
    {
      key: "reinvest",
      label: `Reinvestir (${formatPercent(REINVESTMENT_SHARE, 0)})`,
      value: summary.projected.reinvestment,
      color: YIELD_COLORS.reinvest,
    },
    {
      key: "living",
      label: `Para viver (${formatPercent(1 - REINVESTMENT_SHARE, 0)})`,
      value: summary.projected.livingIncome,
      color: YIELD_COLORS.income,
    },
  ];
  const costs = [
    {
      key: "essential",
      label: `Gasto essencial (+${formatPercent(CONTINGENCY_SHARE, 0)} imprevistos)`,
      value: summary.projected.costs.essential,
    },
    { key: "seasonal", label: "Sazonais (÷ 12)", value: summary.projected.costs.seasonal },
    { key: "travel", label: "Viagens (÷ 12)", value: summary.projected.costs.travel },
    { key: "health", label: "Plano de saúde", value: summary.projected.costs.health },
    { key: "education", label: "Escola dos dependentes", value: summary.projected.costs.education },
    {
      key: "childrenHealth",
      label: "Saúde dos dependentes",
      value: summary.projected.costs.childrenHealth,
    },
  ].filter((cost) => cost.value > 0);
  return (
    <section className="grid content-start gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Heading className="text-subheadline text-muted-foreground">Rentabilidade mensal</Heading>
        <p className="text-title-3 font-semibold tabular-nums">
          <Sensitive>{formatBRL(summary.projected.monthlyYield)}</Sensitive>
          <span className="ml-1.5 text-footnote font-normal text-muted-foreground">
            ≈ {formatPercent(summary.monthlyYieldRate, 2)} a.m.
          </span>
        </p>
      </div>
      <SplitBar parts={parts} />
      <dl className="grid gap-1.5">
        {parts.map((part) => (
          <div key={part.key} className="flex items-center justify-between gap-3 text-sm">
            <dt className="flex min-w-0 items-center gap-2">
              <Swatch color={part.color} />
              {part.label}
            </dt>
            <dd className="text-right font-medium tabular-nums">
              <Sensitive>{formatBRL(part.value)}</Sensitive>
            </dd>
          </div>
        ))}
      </dl>
      <dl className="grid gap-1.5 border-t border-border pt-3">
        {costs.map((cost) => (
          <div key={cost.key} className="flex items-center justify-between gap-3 text-sm">
            <dt className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              {cost.label}
              <CostHelp label={cost.label}>{COST_HELP[cost.key]}</CostHelp>
            </dt>
            <dd className="text-right font-medium text-loss tabular-nums">
              <Sensitive>{formatBRL(-cost.value)}</Sensitive>
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-2 text-sm font-semibold">
          <dt>Sobra líquida para viver</dt>
          <dd
            className={cn(
              "text-right tabular-nums",
              summary.projected.netLiving < 0 ? "text-loss" : "text-gain",
            )}
          >
            <Sensitive>{formatBRL(summary.projected.netLiving)}</Sensitive>
          </dd>
        </div>
      </dl>
      <p className="text-footnote text-muted-foreground">
        {summary.projected.years > 0
          ? `Valores esperados no primeiro dia da aposentadoria, daqui a ${summary.projected.years} ${summary.projected.years === 1 ? "ano" : "anos"}: os de hoje corrigidos pela inflação (${formatPercent(GENERAL_INFLATION, 1)} a.a.; escola a ${formatPercent(EDUCATION_INFLATION, 0)} a.a.).`
          : "Valores de hoje: a aposentadoria é a partir de agora."}
      </p>
      <p className="text-footnote text-muted-foreground">
        Com {yieldLabel(summary)}, a meta recebe esse valor por mês. Os{" "}
        {formatPercent(REINVESTMENT_SHARE, 0)} reinvestidos repõem a inflação (≈&nbsp;
        {formatPercent(REINVESTMENT_SHARE * summary.annualYield, 1)} ao ano) e o resto é para viver.
      </p>
    </section>
  );
}
