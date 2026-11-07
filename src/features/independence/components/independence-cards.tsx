import { CalendarClockIcon, FlagIcon } from "lucide-react";
import type { ReactNode } from "react";
import { MetricNote, StatList, StatRow } from "@/shared/components/metric";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { HEALTH_LEVEL_LABELS } from "../domain/catalog";
import { durationLabel } from "../domain/plan";
import type { IndependencePlan, IndependenceSummary } from "../domain/types";
import { SplitBar, Swatch, VerdictChip, YieldSplit } from "./figures";
import { forecastTitle, forecastVerdict, monthSlash } from "./format";
import { ProgressBar } from "./progress-bar";

const money = (value: number) => <Sensitive>{formatBRL(value)}</Sensitive>;

const listAges = (ages: number[]) =>
  ages.length <= 1 ? ages.join("") : `${ages.slice(0, -1).join(", ")} e ${ages[ages.length - 1]}`;

/** As cores das duas partes da meta (diferentes das da rentabilidade, na mesma página). */
const PART_COLORS = { perpetual: "var(--chart-7)", temporary: "var(--chart-4)" } as const;

/**
 * O topo da página: o montante que a independência pede, em destaque, o patrimônio contra ele e
 * o que a meta rende por mês, com o reinvestimento que repõe a inflação.
 */
export function TargetCard({
  summary,
  className,
}: {
  summary: IndependenceSummary;
  className?: string;
}) {
  const reached = summary.progress >= 1;
  return (
    <Card className={cn("card-lift", className)}>
      <CardContent className="@container/target">
        <div className="grid gap-6 @min-[640px]/target:grid-cols-2 @min-[640px]/target:gap-8">
          <div className="grid content-start gap-4">
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
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-footnote">
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatPercent(summary.progress, 1)}
                  </span>{" "}
                  · {money(summary.patrimony)} de patrimônio
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {reached ? "Acima da meta" : "Faltam"}{" "}
                  <span className="font-semibold text-foreground">
                    {money(Math.abs(summary.target - summary.patrimony))}
                  </span>
                </span>
              </div>
              {summary.externalWealth > 0 ? (
                <p className="text-footnote text-muted-foreground tabular-nums">
                  {money(summary.koinosWealth)} no Koinos + {money(summary.externalWealth)} fora
                  dele
                </p>
              ) : null}
            </div>
          </div>
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
 * O prazo: a idade prevista no ritmo de hoje contra a idade alvo e, ao lado, o aporte de hoje
 * contra o que chegaria nela. Lado a lado na mesa, um embaixo do outro no iPhone.
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
  return (
    <Card className="card-lift">
      <CardContent className="@container/forecast">
        <div className="grid gap-6 @min-[640px]/forecast:grid-cols-2 @min-[640px]/forecast:gap-8">
          <section className="grid content-start gap-3">
            <h2 className="flex items-center gap-2 text-subheadline text-muted-foreground">
              <span className="tile size-6 rounded-sm [--tile:var(--tile-orange)]">
                <CalendarClockIcon className="size-3.5" aria-hidden="true" />
              </span>
              Prazo no ritmo de hoje
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
                Em {monthSlash(summary.targetMonth)}, daqui a {durationLabel(months)}.
              </p>
            ) : null}
          </section>
          <section className="grid content-start gap-3 border-t border-border/70 pt-5 @min-[640px]/forecast:border-t-0 @min-[640px]/forecast:border-l @min-[640px]/forecast:pt-0 @min-[640px]/forecast:pl-8">
            <h3 className="text-subheadline text-muted-foreground">Aporte por mês</h3>
            <StatList className="border-t-0 pt-0">
              <StatRow label="Hoje" value={money(summary.monthlyAporte)} />
              {summary.requiredAporte !== null ? (
                <StatRow
                  label={`Para parar aos ${plan.targetAge}`}
                  value={money(summary.requiredAporte)}
                />
              ) : null}
            </StatList>
            {summary.requiredAporte !== null ? (
              <AporteMeter current={summary.monthlyAporte} required={summary.requiredAporte} />
            ) : null}
            <MetricNote>
              O aporte de hoje é a média do dinheiro do bolso nos 6 meses fechados, menos as vendas.
              O patrimônio rende {formatPercent(summary.realRate, 1)} ao mês acima da inflação.
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
  color,
  children,
}: {
  title: string;
  description: string;
  color?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid content-start gap-2">
      <div className="grid gap-0.5">
        <h3 className="flex items-center gap-2 text-subheadline font-semibold">
          {color ? <Swatch color={color} /> : null}
          {title}
        </h3>
        <p className="text-footnote text-muted-foreground">{description}</p>
      </div>
      <dl className="grid border-t border-border/70">{children}</dl>
    </section>
  );
}

/**
 * A conta da meta, em grupos com subtotal: a renda do mês, a meta perpétua (que rende para
 * sempre) e o fundo temporário (gasto até o mais novo sair do orçamento). Lado a lado na mesa.
 */
export function TargetBreakdown({
  plan,
  summary,
}: {
  plan: IndependencePlan;
  summary: IndependenceSummary;
}) {
  const level = HEALTH_LEVEL_LABELS[plan.healthLevel].label;
  const withHealth = plan.healthLevel !== "nenhum";
  const withFund = plan.dependents > 0;
  const steps =
    summary.healthStepAges.length > 0 ? `; sobe aos ${listAges(summary.healthStepAges)}` : "";
  const rate = formatPercent(summary.realRate, 1);
  const parts = [
    {
      key: "perpetual",
      label: "Meta perpétua",
      value: summary.perpetual,
      color: PART_COLORS.perpetual,
    },
    {
      key: "temporary",
      label: "Fundo temporário",
      value: summary.temporary,
      color: PART_COLORS.temporary,
    },
  ];
  return (
    <Card className="card-lift">
      <CardHeader>
        <CardTitle>Como a meta é calculada</CardTitle>
        <CardDescription>
          Tudo em reais de hoje, com o valor na idade alvo ({plan.targetAge} anos).
        </CardDescription>
      </CardHeader>
      <CardContent className="@container/breakdown grid gap-6">
        {withFund && summary.temporary > 0 ? (
          <div className="grid gap-2">
            <SplitBar parts={parts} />
            <ul
              aria-label="Divisão da meta"
              className="flex flex-wrap gap-x-4 gap-y-1 text-footnote"
            >
              {parts.map((part) => (
                <li key={part.key} className="flex items-center gap-1.5">
                  <Swatch color={part.color} />
                  <span className="text-muted-foreground">{part.label}</span>
                  <span className="font-medium tabular-nums">
                    {formatPercent(summary.target > 0 ? part.value / summary.target : 0, 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div
          className={cn(
            "grid gap-6 @min-[720px]/breakdown:gap-8",
            withFund
              ? "@min-[720px]/breakdown:grid-cols-2 @min-[1000px]/breakdown:grid-cols-3"
              : "@min-[720px]/breakdown:grid-cols-2",
          )}
        >
          <BreakdownGroup title="Custo de vida" description="O que a vida pede por mês.">
            <BreakdownRow label="Gasto fixo" value={money(plan.essentialMonthly)} />
            <BreakdownRow
              label="Gastos do ano"
              detail={<>{money(plan.seasonalYearly)} por ano ÷ 12</>}
              value={money(plan.seasonalYearly / 12)}
            />
            <BreakdownRow
              label="Viagens e lazer"
              detail={<>{money(plan.travelYearly)} por ano ÷ 12</>}
              value={money(plan.travelYearly / 12)}
            />
            <BreakdownRow total label="Por mês" value={money(summary.perpetualIncome)} />
          </BreakdownGroup>
          <BreakdownGroup
            title="Meta perpétua"
            description={`Rende ${rate} ao mês acima da inflação, para sempre.`}
            color={withFund ? PART_COLORS.perpetual : undefined}
          >
            <BreakdownRow
              label="Custo de vida"
              detail={
                <>
                  {money(summary.perpetualIncome)} ÷ {rate}
                </>
              }
              value={money(summary.incomeCapital)}
            />
            {withHealth ? (
              <BreakdownRow
                label="Saúde do titular"
                detail={
                  <>
                    {level}: {money(summary.titularHealthNow)}/mês aos {plan.targetAge}
                    {steps}
                  </>
                }
                value={money(summary.titularHealth)}
              />
            ) : null}
            {withHealth && summary.spouseAgeAtTarget !== null ? (
              <BreakdownRow
                label="Saúde do cônjuge"
                detail={`${summary.spouseAgeAtTarget} anos na idade alvo`}
                value={money(summary.spouseHealth)}
              />
            ) : null}
            <BreakdownRow total label="Meta perpétua" value={money(summary.perpetual)} />
          </BreakdownGroup>
          {withFund ? (
            <BreakdownGroup
              title="Fundo temporário"
              description={`Gasto até o mais novo fazer ${plan.educationUntil} anos.`}
              color={PART_COLORS.temporary}
            >
              <BreakdownRow
                label="Escola"
                detail={
                  summary.educationFund > 0
                    ? `Depois dos ${plan.targetAge}, +8% ao ano, 13 por ano`
                    : `O mais novo faz ${plan.educationUntil} antes dos ${plan.targetAge}`
                }
                value={money(summary.educationFund)}
              />
              <BreakdownRow
                label={
                  plan.dependents === 1
                    ? "Saúde do dependente"
                    : `Saúde dos ${plan.dependents} dependentes`
                }
                detail={withHealth ? `${level}, pela faixa do mais novo` : "Sem plano particular"}
                value={money(summary.childrenHealthFund)}
              />
              <BreakdownRow total label="Fundo temporário" value={money(summary.temporary)} />
            </BreakdownGroup>
          ) : null}
        </div>
        <dl className="border-t border-border/70 pt-1">
          <div className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-headline">Montante necessário</dt>
            <dd className="text-headline tabular-nums">{money(summary.target)}</dd>
          </div>
        </dl>
        <p className="-mt-3 text-footnote text-muted-foreground">
          A escola corrige 8% ao ano e é trazida a hoje por 9,5% ao ano; a saúde segue a tabela de
          2026 por faixa etária (plano individual, São Paulo).
        </p>
      </CardContent>
    </Card>
  );
}
