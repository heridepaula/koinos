import { CalculatorIcon, CalendarClockIcon, FlagIcon } from "lucide-react";
import { MetricCard, MetricNote, StatList, StatRow } from "@/shared/components/metric";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { HEALTH_LEVEL_LABELS } from "../domain/catalog";
import { durationLabel } from "../domain/plan";
import type { IndependencePlan, IndependenceSummary } from "../domain/types";
import { monthSlash } from "./format";
import { ProgressBar } from "./progress-bar";

const money = (value: number) => <Sensitive>{formatBRL(value)}</Sensitive>;

const listAges = (ages: number[]) =>
  ages.length <= 1 ? ages.join("") : `${ages.slice(0, -1).join(", ")} e ${ages[ages.length - 1]}`;

/** Card 1: a meta total em destaque e o patrimônio contra ela. */
export function ProgressCard({ summary }: { summary: IndependenceSummary }) {
  return (
    <MetricCard
      icon={FlagIcon}
      tile="[--tile:var(--tile-green)]"
      label={`Meta · ${formatPercent(summary.progress, 1)}`}
      value={money(summary.target)}
    >
      <ProgressBar value={summary.progress} label="Progresso da meta" className="mb-3" />
      <StatList>
        <StatRow label="Patrimônio no Koinos" value={money(summary.koinosWealth)} />
        {summary.externalWealth > 0 ? (
          <StatRow label="Patrimônio fora do Koinos" value={money(summary.externalWealth)} />
        ) : null}
        <StatRow
          label={summary.progress >= 1 ? "Acima da meta" : "Falta"}
          value={money(Math.abs(summary.target - summary.patrimony))}
        />
      </StatList>
    </MetricCard>
  );
}

/** Card 2: o prazo no ritmo dos últimos 6 meses, contra a idade alvo. */
export function ForecastCard({
  plan,
  summary,
}: {
  plan: IndependencePlan;
  summary: IndependenceSummary;
}) {
  const value =
    summary.months === null
      ? "Sem prazo"
      : summary.months === 0
        ? "Meta alcançada"
        : `Aos ~${summary.predictedAge} anos`;
  return (
    <MetricCard
      icon={CalendarClockIcon}
      tile="[--tile:var(--tile-orange)]"
      label="Prazo estimado"
      value={value}
    >
      <StatList>
        <StatRow
          label="Quando"
          value={
            summary.months && summary.targetMonth
              ? `${durationLabel(summary.months)} (${monthSlash(summary.targetMonth)})`
              : "—"
          }
        />
        {summary.slackMonths !== null ? (
          <StatRow
            label={`Antes dos ${plan.targetAge} anos`}
            value={durationLabel(summary.slackMonths)}
          />
        ) : null}
        {summary.requiredAporte !== null ? (
          <StatRow
            label={`Aporte para parar aos ${plan.targetAge}`}
            value={<>{money(summary.requiredAporte)}/mês</>}
          />
        ) : null}
        <StatRow label="Aporte do bolso (média 6 meses)" value={money(summary.monthlyAporte)} />
        <StatRow label="Taxa real" value={`${formatPercent(summary.realRate, 1)} a.m.`} />
      </StatList>
      <MetricNote>
        {summary.months === null
          ? "Nesse ritmo o patrimônio não chega à meta: sem aporte do bolso e sem patrimônio, não há o que render."
          : "Taxa real fixa de 0,4% a.m. (≈ 4,9% a.a. acima da inflação). O aporte conta só o dinheiro do bolso, menos as vendas."}
      </MetricNote>
    </MetricCard>
  );
}

/** Card 4: a conta linha a linha. */
export function TargetBreakdown({
  plan,
  summary,
}: {
  plan: IndependencePlan;
  summary: IndependenceSummary;
}) {
  const level = HEALTH_LEVEL_LABELS[plan.healthLevel].label;
  const steps =
    summary.healthStepAges.length > 0 ? `, degraus aos ${listAges(summary.healthStepAges)}` : "";
  return (
    <MetricCard
      icon={CalculatorIcon}
      tile="[--tile:var(--tile-indigo)]"
      label="Como chegamos na meta"
      value={money(summary.target)}
    >
      <StatList>
        <StatRow label="Custo essencial por mês" value={money(plan.essentialMonthly)} />
        <StatRow label="Sazonais (por ano ÷ 12)" value={money(plan.seasonalYearly / 12)} />
        <StatRow label="Viagens e lazer (por ano ÷ 12)" value={money(plan.travelYearly / 12)} />
        <StatRow label="Renda perpétua ÷ 0,4%" value={money(summary.incomeCapital)} />
        {plan.healthLevel !== "nenhum" ? (
          <StatRow
            label={`Saúde ${level} do titular (${formatBRL(summary.titularHealthNow)} aos ${plan.targetAge}${steps})`}
            value={money(summary.titularHealth)}
          />
        ) : null}
        {summary.spouseAgeAtTarget !== null && plan.healthLevel !== "nenhum" ? (
          <StatRow
            label={`Saúde do cônjuge (aos ${summary.spouseAgeAtTarget} na idade alvo)`}
            value={money(summary.spouseHealth)}
          />
        ) : null}
        <StatRow label="Meta perpétua" value={money(summary.perpetual)} />
        {plan.dependents > 0 ? (
          <>
            <StatRow
              label={`Escola depois dos ${plan.targetAge} (até o mais novo fazer ${plan.educationUntil})`}
              value={money(summary.educationFund)}
            />
            <StatRow
              label={`Saúde dos ${plan.dependents === 1 ? "dependente" : `${plan.dependents} dependentes`}`}
              value={money(summary.childrenHealthFund)}
            />
            <StatRow label="Fundo temporário" value={money(summary.temporary)} />
          </>
        ) : null}
      </StatList>
      <MetricNote>
        Tudo em reais de hoje, com o valor na idade alvo. A escola corrige 8% a.a. (13 mensalidades
        por ano) e desconta 9,5% a.a.; a saúde segue a tabela de 2026 por faixa etária (plano
        individual, São Paulo).
      </MetricNote>
    </MetricCard>
  );
}
