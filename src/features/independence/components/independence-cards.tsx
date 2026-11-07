import { CalendarClockIcon, CalculatorIcon, FlagIcon } from "lucide-react";
import { MetricCard, MetricNote, StatList, StatRow } from "@/shared/components/metric";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { durationLabel } from "../domain/plan";
import type { IndependencePlan, IndependenceSummary } from "../domain/types";
import { monthSlash } from "./format";
import { ProgressBar } from "./progress-bar";

const money = (value: number) => <Sensitive>{formatBRL(value)}</Sensitive>;

/** Card 1: o patrimônio de hoje contra a meta. */
export function ProgressCard({ summary }: { summary: IndependenceSummary }) {
  return (
    <MetricCard
      icon={FlagIcon}
      tile="[--tile:var(--tile-green)]"
      label="Progresso"
      value={formatPercent(summary.progress, 1)}
    >
      <ProgressBar value={summary.progress} label="Progresso da meta" className="mb-3" />
      <StatList>
        <StatRow label="Patrimônio atual" value={money(summary.patrimony)} />
        <StatRow label="Meta" value={money(summary.target)} />
        <StatRow
          label={summary.progress >= 1 ? "Acima da meta" : "Falta"}
          value={money(Math.abs(summary.target - summary.patrimony))}
        />
      </StatList>
    </MetricCard>
  );
}

/** Card 2: como a meta sai das respostas. */
export function TargetBreakdown({
  plan,
  summary,
}: {
  plan: IndependencePlan;
  summary: IndependenceSummary;
}) {
  const people = `${plan.people} ${plan.people === 1 ? "pessoa" : "pessoas"}`;
  return (
    <MetricCard
      icon={CalculatorIcon}
      tile="[--tile:var(--tile-indigo)]"
      label="Como chegamos na meta"
      value={money(summary.target)}
    >
      <StatList>
        <StatRow label="Custo de vida" value={money(plan.livingCost)} />
        <StatRow
          label={`Saúde (${formatBRL(plan.healthPerPerson)} × ${people})`}
          value={money(plan.healthPerPerson * plan.people)}
        />
        <StatRow label="Viagens (por ano ÷ 12)" value={money(plan.travelPerYear / 12)} />
        <StatRow label="Renda líquida por mês" value={money(summary.need)} />
        <StatRow
          label={`Retenção de ${formatPercent(plan.retention, 0)}`}
          value={money(summary.gross - summary.need)}
        />
        <StatRow label="Renda bruta por mês" value={money(summary.gross)} />
        <StatRow
          label={
            summary.yieldSource === "carteira"
              ? "Yield da carteira (12 meses)"
              : "Yield padrão (sem dado da carteira)"
          }
          value={`${formatPercent(summary.monthlyYield)} a.m.`}
        />
      </StatList>
      <MetricNote>
        Meta = renda bruta ÷ yield mensal, em reais de hoje. A retenção é o que volta para a
        carteira e repõe a inflação.
      </MetricNote>
    </MetricCard>
  );
}

/** Card 3: o prazo no ritmo dos últimos 6 meses. */
export function ForecastCard({ summary }: { summary: IndependenceSummary }) {
  const value =
    summary.months === null
      ? "Sem prazo"
      : summary.months === 0
        ? "Meta alcançada"
        : durationLabel(summary.months);
  return (
    <MetricCard
      icon={CalendarClockIcon}
      tile="[--tile:var(--tile-orange)]"
      label="Prazo estimado"
      value={value}
    >
      <StatList>
        <StatRow
          label="Data estimada"
          value={summary.targetMonth && summary.months ? monthSlash(summary.targetMonth) : "—"}
        />
        <StatRow label="Aporte do bolso (média 6 meses)" value={money(summary.monthlyAporte)} />
        <StatRow label="Taxa real" value={`${formatPercent(summary.realRate)} a.m.`} />
      </StatList>
      <MetricNote>
        {summary.months === null
          ? "Nesse ritmo o patrimônio não chega à meta: sem aporte do bolso e sem patrimônio, não há o que render."
          : "Taxa real = yield × (1 − retenção). Os proventos já estão nela, então o aporte conta só o dinheiro do bolso, menos as vendas."}
      </MetricNote>
    </MetricCard>
  );
}
