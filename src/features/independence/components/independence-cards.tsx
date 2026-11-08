import { CalendarClockIcon, FlagIcon } from "lucide-react";
import type { ReactNode } from "react";
import { MetricNote, StatList, StatRow } from "@/shared/components/metric";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { APORTE_MONTHS } from "../domain/aporte";
import { HEALTH_LEVEL_LABELS } from "../domain/catalog";
import {
  CONTINGENCY_SHARE,
  EDUCATION_INFLATION,
  GENERAL_INFLATION,
  REINVESTMENT_SHARE,
} from "../domain/constants";
import { durationLabel } from "../domain/plan";
import type { IndependencePlan, IndependenceSummary } from "../domain/types";
import { VerdictChip, YieldSplit } from "./figures";
import { forecastTitle, forecastVerdict, monthSlash, retirementLabel, yieldLabel } from "./format";
import { ProgressBar } from "./progress-bar";

const money = (value: number) => <Sensitive>{formatBRL(value)}</Sensitive>;

const listAges = (ages: number[]) =>
  ages.length <= 1 ? ages.join("") : `${ages.slice(0, -1).join(", ")} e ${ages[ages.length - 1]}`;

/** Uma parte do patrimônio, recuada e mais leve que o total acima dela. */
const subRow = (label: string, value: number) => (
  <StatRow
    label={<span className="pl-3">{label}</span>}
    value={<span className="font-normal text-muted-foreground">{money(value)}</span>}
  />
);

/**
 * O topo da página, em duas colunas do mesmo peso. À esquerda, onde você está: o montante, o
 * progresso, o patrimônio, quanto ele rende por mês hoje, o DY de que a meta depende e para quando
 * ela é. À direita, o que a meta rende por mês e para onde vai (`YieldSplit`).
 */
export function TargetCard({
  plan,
  summary,
  className,
}: {
  plan: IndependencePlan;
  summary: IndependenceSummary;
  className?: string;
}) {
  const reached = summary.progress >= 1;
  return (
    <Card className={cn("card-lift", className)}>
      <CardContent className="@container/target">
        <div className="grid gap-6 @min-[640px]/target:grid-cols-2 @min-[640px]/target:gap-8">
          <section className="grid content-start gap-4">
            <div className="grid gap-2">
              <h2 className="flex items-center gap-2 text-subheadline text-muted-foreground">
                <span className="tile size-6 rounded-sm [--tile:var(--tile-green)]">
                  <FlagIcon className="size-3.5" aria-hidden="true" />
                </span>
                Montante necessário
              </h2>
              <p className="text-large-title tabular-nums">{money(summary.target)}</p>
            </div>
            <div className="grid gap-2">
              <ProgressBar value={summary.progress} label="Progresso da meta" />
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-footnote text-muted-foreground tabular-nums">
                <span>
                  <span className="font-semibold text-foreground">
                    {formatPercent(summary.progress, 1)}
                  </span>{" "}
                  da meta
                </span>
                <span>
                  {reached ? "Acima da meta" : "Faltam"}{" "}
                  <span className="font-semibold text-foreground">
                    {money(Math.abs(summary.target - summary.patrimony))}
                  </span>
                </span>
              </div>
            </div>
            <StatList>
              <StatRow label="Patrimônio hoje" value={money(summary.patrimony)} />
              {summary.externalWealth > 0 ? (
                <>
                  {subRow("No Koinos", summary.koinosWealth)}
                  {subRow("Fora do Koinos", summary.externalWealth)}
                </>
              ) : null}
              <StatRow
                label="Rende por mês hoje"
                value={<>≈&nbsp;{money(summary.monthlyDividendsToday)}</>}
              />
              <StatRow
                label={
                  summary.yieldSource === "dy" ? "DY dos seus ativos" : "Rendimento de referência"
                }
                value={`${formatPercent(summary.annualYield, 1)} ao ano`}
              />
              <StatRow label="Aposentadoria" value={retirementLabel(plan, summary)} />
            </StatList>
            <MetricNote>
              A meta é a rentabilidade mensal ÷ {formatPercent(summary.monthlyYieldRate, 2)} ao mês:
              com um DY menor, ela sobe.
            </MetricNote>
          </section>
          <div className="border-t border-border/70 pt-5 @min-[640px]/target:border-t-0 @min-[640px]/target:border-l @min-[640px]/target:pt-0 @min-[640px]/target:pl-8">
            <YieldSplit summary={summary} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * O medidor do aporte: o de hoje contra o que chegaria à meta na idade alvo. Cheio quando o de
 * hoje já basta; o texto do leitor de tela diz os dois valores.
 */
function AporteMeter({ current, required }: { current: number; required: number }) {
  const fill = required > 0 ? Math.min(1, current / required) : 1;
  return (
    <div
      role="meter"
      aria-label="Aporte de hoje contra o necessário"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fill * 100)}
      aria-valuetext={`${formatPercent(fill, 0)} do aporte necessário`}
      className="-mt-1 h-1.5 overflow-hidden rounded-full bg-warn/15"
    >
      <div className="h-full rounded-full bg-warn" style={{ width: `${fill * 100}%` }} />
    </div>
  );
}

/**
 * O prazo: a idade em que a meta chega com o aporte de hoje (a média do bolso) contra a idade alvo
 * e, ao lado, o aporte de hoje contra o que chegaria nela e quanto falta pôr a mais. Lado a lado
 * na mesa, um embaixo do outro no iPhone.
 */
export function ForecastCard({
  plan,
  summary,
}: {
  plan: IndependencePlan;
  summary: IndependenceSummary;
}) {
  const verdict = forecastVerdict(plan, summary);
  const months = summary.months;
  const pending = months !== null && months > 0;
  const yearlyGrowth = Math.pow(1 + summary.monthlyYieldRate, 12) - 1;
  return (
    <Card className="card-lift">
      <CardContent className="@container/forecast">
        <div className="grid gap-6 @min-[640px]/forecast:grid-cols-2 @min-[640px]/forecast:gap-8">
          <section className="grid content-start gap-3">
            <h2 className="flex items-center gap-2 text-subheadline text-muted-foreground">
              <span className="tile size-6 rounded-sm [--tile:var(--tile-orange)]">
                <CalendarClockIcon className="size-3.5" aria-hidden="true" />
              </span>
              Prazo com o aporte de hoje
            </h2>
            <p className="text-title-1 tabular-nums">{forecastTitle(summary)}</p>
            {pending ? (
              <VerdictChip tone={verdict.tone}>{verdict.text}</VerdictChip>
            ) : (
              <p className="text-footnote text-muted-foreground">
                {months === 0
                  ? "O patrimônio já cobre a meta."
                  : "Nesse ritmo o patrimônio não chega à meta."}
              </p>
            )}
            {pending && summary.targetMonth ? (
              <p className="text-footnote text-muted-foreground tabular-nums">
                Em {monthSlash(summary.targetMonth)}, daqui a {durationLabel(months)}, com{" "}
                {money(summary.monthlyAporte)} por mês do bolso e o DY reinvestido.
              </p>
            ) : null}
            {pending ? (
              <p className="text-footnote text-muted-foreground tabular-nums">
                Os proventos crescem todo mês, com o reinvestimento e o aporte: de ≈&nbsp;
                {money(summary.monthlyDividendsToday)} hoje a {money(summary.monthlyYield)} por mês
                na meta.
              </p>
            ) : null}
          </section>
          <section className="grid content-start gap-3 border-t border-border/70 pt-5 @min-[640px]/forecast:border-t-0 @min-[640px]/forecast:border-l @min-[640px]/forecast:pt-0 @min-[640px]/forecast:pl-8">
            <h3 className="text-subheadline text-muted-foreground">Aporte do bolso por mês</h3>
            <StatList className="border-t-0 pt-0">
              <StatRow
                label={`Hoje (média de ${APORTE_MONTHS} meses)`}
                value={money(summary.monthlyAporte)}
              />
              {summary.requiredAporte !== null ? (
                <StatRow
                  label={`Para parar aos ${plan.targetAge}`}
                  value={money(summary.requiredAporte)}
                />
              ) : null}
              {summary.extraAporte !== null ? (
                <StatRow
                  label="A mais por mês"
                  value={<span className="font-semibold">+{money(summary.extraAporte)}</span>}
                />
              ) : null}
            </StatList>
            {summary.requiredAporte !== null ? (
              <AporteMeter current={summary.monthlyAporte} required={summary.requiredAporte} />
            ) : null}
            <MetricNote>
              {summary.extraAporte !== null ? (
                <>
                  Para parar aos {plan.targetAge}, o bolso precisa pôr {money(summary.extraAporte)}{" "}
                  a mais por mês, além do DY reinvestido.{" "}
                </>
              ) : summary.slackMonths !== null && summary.slackMonths > 0 ? (
                <>
                  O aporte de hoje já basta: a meta chega {durationLabel(summary.slackMonths)} antes
                  dos {plan.targetAge}.{" "}
                </>
              ) : null}
              A conta é de juros compostos: todo mês, o patrimônio rende{" "}
              {formatPercent(summary.monthlyYieldRate, 2)} sobre o do mês anterior, com{" "}
              {yieldLabel(summary)} reinvestido (≈&nbsp;{formatPercent(yearlyGrowth, 1)} ao ano), e
              recebe o aporte do bolso, a média dos {APORTE_MONTHS} meses fechados menos as vendas.
              A meta já está em reais do primeiro dia da aposentadoria, então a inflação não é
              descontada de novo.
            </MetricNote>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

/** Uma linha da conta: o rótulo, um detalhe opcional embaixo e o valor à direita. */
function BreakdownRow({
  label,
  detail,
  value,
  total = false,
}: {
  label: ReactNode;
  detail?: ReactNode;
  value: ReactNode;
  total?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 py-2 text-sm",
        total && "border-t border-border/70 font-semibold",
      )}
    >
      <dt className="grid min-w-0 gap-0.5">
        <span>{label}</span>
        {detail ? <span className="text-footnote text-muted-foreground">{detail}</span> : null}
      </dt>
      <dd className="shrink-0 text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Um grupo da conta, com título, a frase do que ele paga e as linhas até o subtotal. */
function BreakdownGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid content-start gap-2">
      <div className="grid gap-0.5">
        <h3 className="text-subheadline font-semibold">{title}</h3>
        <p className="text-footnote text-muted-foreground">{description}</p>
      </div>
      <dl className="grid border-t border-border/70">{children}</dl>
    </section>
  );
}

/**
 * A conta da meta em dois grupos com subtotal, lado a lado na mesa (spec v2 §10): o mês do
 * primeiro dia da aposentadoria (o essencial livre e os outros custos, com a inflação até lá) e o
 * rendimento que o paga com os 24% reinvestidos. O montante é esse rendimento ÷ o DY do mês.
 */
export function TargetBreakdown({
  plan,
  summary,
}: {
  plan: IndependencePlan;
  summary: IndependenceSummary;
}) {
  const { costs, years } = summary;
  const level = HEALTH_LEVEL_LABELS[plan.healthLevel].label;
  const spouseAge = summary.spouseAgeAtTarget;
  const steps =
    summary.healthStepAges.length > 0 ? `; sobe aos ${listAges(summary.healthStepAges)}` : "";
  const youngestAtTarget = plan.youngestAge === null ? null : plan.youngestAge + years;
  return (
    <Card className="card-lift">
      <CardHeader>
        <CardTitle>Como a meta é calculada</CardTitle>
        <CardDescription>
          {years > 0
            ? `Um mês aos ${plan.targetAge}, daqui a ${years} ${years === 1 ? "ano" : "anos"}: os custos de hoje com a inflação de ${formatPercent(GENERAL_INFLATION, 1)} ao ano até lá.`
            : "Um mês a partir de hoje, com os custos de hoje."}
        </CardDescription>
      </CardHeader>
      <CardContent className="@container/breakdown grid gap-6">
        <div className="grid gap-6 @min-[720px]/breakdown:grid-cols-2 @min-[720px]/breakdown:gap-8">
          <BreakdownGroup
            title="O mês da aposentadoria"
            description="O que os 76% do rendimento pagam: o essencial livre e os outros custos."
          >
            <BreakdownRow
              label="Livre para viver"
              detail={
                <>
                  Essencial de {money(plan.essentialMonthly)} +{" "}
                  {formatPercent(CONTINGENCY_SHARE, 0)} de imprevistos
                </>
              }
              value={money(costs.essential)}
            />
            {costs.seasonal > 0 ? (
              <BreakdownRow
                label="Gastos do ano"
                detail={<>{money(plan.seasonalYearly)} por ano ÷ 12</>}
                value={money(costs.seasonal)}
              />
            ) : null}
            {costs.travel > 0 ? (
              <BreakdownRow
                label="Viagens e lazer"
                detail={<>{money(plan.travelYearly)} por ano ÷ 12</>}
                value={money(costs.travel)}
              />
            ) : null}
            {costs.health > 0 ? (
              <BreakdownRow
                label="Plano de saúde"
                detail={
                  <>
                    {level}: titular aos {plan.targetAge}
                    {spouseAge !== null ? ` e cônjuge aos ${spouseAge}` : ""},{" "}
                    {money(summary.costsToday.health)} hoje{steps}
                  </>
                }
                value={money(costs.health)}
              />
            ) : null}
            {costs.education > 0 ? (
              <BreakdownRow
                label="Escola"
                detail={
                  <>
                    {money(plan.educationMonthly)} por mês hoje, +
                    {formatPercent(EDUCATION_INFLATION, 0)} ao ano; o mais novo terá{" "}
                    {youngestAtTarget}
                  </>
                }
                value={money(costs.education)}
              />
            ) : null}
            {costs.childrenHealth > 0 ? (
              <BreakdownRow
                label={
                  plan.dependents === 1
                    ? "Saúde do dependente"
                    : `Saúde dos ${plan.dependents} dependentes`
                }
                detail={`${level}, pela faixa do mais novo`}
                value={money(costs.childrenHealth)}
              />
            ) : null}
            <BreakdownRow total label="Por mês" value={money(summary.livingIncome)} />
          </BreakdownGroup>
          <BreakdownGroup
            title="Rendimento do mês"
            description={`Com ${yieldLabel(summary)}: ${formatPercent(summary.monthlyYieldRate, 2)} ao mês.`}
          >
            <BreakdownRow
              label={`Para o mês (${formatPercent(1 - REINVESTMENT_SHARE, 0)})`}
              value={money(summary.livingIncome)}
            />
            <BreakdownRow
              label={`Reinvestir (${formatPercent(REINVESTMENT_SHARE, 0)})`}
              detail="Volta para a carteira, para repor a inflação"
              value={money(summary.reinvestment)}
            />
            <BreakdownRow total label="Rendimento" value={money(summary.monthlyYield)} />
          </BreakdownGroup>
        </div>
        <dl className="border-t border-border/70 pt-1">
          <div className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-headline">Montante necessário</dt>
            <dd className="text-headline tabular-nums">{money(summary.target)}</dd>
          </div>
        </dl>
        <p className="-mt-3 text-footnote text-muted-foreground">
          O rendimento do mês ÷ {formatPercent(summary.monthlyYieldRate, 2)}: com um DY menor, a
          meta sobe. A saúde segue a tabela de 2026 por faixa etária (plano individual, São Paulo),
          na faixa da idade alvo
          {summary.healthStepAges.length > 0 ? "; as faixas seguintes não entram na meta" : ""}.
        </p>
      </CardContent>
    </Card>
  );
}
