import { CircleCheckIcon, ClockIcon, HandCoinsIcon } from "lucide-react";
import { DIVIDEND_KIND_LABELS } from "@/features/transactions";
import { MetricCard, StatList, StatRow } from "@/shared/components/metric";
import { formatBRL, formatMonth, formatPercent } from "@/shared/lib/format";
import type { DividendMonthSummary } from "../../domain/types";
import { Sensitive } from "@/shared/components/sensitive";

/**
 * Mês atual em três cards de número: o que já caiu (extrato da B3), o que falta cair (a lista da
 * B3 ou, sem ela, os anúncios do Yahoo) e o total, que mostra numa barra quanto do mês já entrou.
 * No card estreito (o celular), um card só: o total com a barra e, embaixo, o recebido e o a
 * receber em linhas, em vez de três cards empilhados.
 */
export function DividendMonthCards({
  month,
  forecastAsOf,
}: {
  month: DividendMonthSummary;
  forecastAsOf: Date | null;
}) {
  const upcomingLabel = forecastAsOf ? "A receber" : "A receber (estimado)";
  const share = month.total > 0 ? Math.min(1, month.received / month.total) : 0;
  return (
    // Três colunas só quando cada card tem espaço para o valor sem quebrar a linha. O container
    // tem nome: o rótulo fica dentro do cabeçalho do card, que é outro container.
    <div className="@container/month">
      <div className="grid gap-4 md:gap-6 @min-[720px]/month:grid-cols-3">
        <MetricCard
          icon={CircleCheckIcon}
          tile="[--tile:var(--tile-green)]"
          label={`Recebido em ${formatMonth(month.month)}`}
          value={<Sensitive>{formatBRL(month.received)}</Sensitive>}
          className="hidden @min-[720px]/month:flex"
        />
        <MetricCard
          icon={ClockIcon}
          tile="[--tile:var(--tile-orange)]"
          label={upcomingLabel}
          value={<Sensitive>{formatBRL(month.upcoming)}</Sensitive>}
          className="hidden @min-[720px]/month:flex"
        >
          {forecastAsOf ? null : (
            <p className="text-footnote text-muted-foreground">
              Previsão pelo Yahoo, confirmada quando o extrato da B3 for importado.
            </p>
          )}
        </MetricCard>
        <MetricCard
          icon={HandCoinsIcon}
          tile="[--tile:var(--tile-teal)]"
          label={
            <>
              <span className="@min-[720px]/month:hidden">
                Proventos de {formatMonth(month.month)}
              </span>
              <span className="hidden @min-[720px]/month:inline">Total do mês</span>
            </>
          }
          value={<Sensitive>{formatBRL(month.total)}</Sensitive>}
          className="metal-ring brushed"
        >
          <div className="grid gap-3">
            <MonthProgress share={share} />
            <StatList className="@min-[720px]/month:hidden">
              <StatRow
                label={`Recebido · ${formatPercent(share, 0)}`}
                value={<Sensitive>{formatBRL(month.received)}</Sensitive>}
              />
              <StatRow
                label={`${upcomingLabel} · ${formatPercent(1 - share, 0)}`}
                value={<Sensitive>{formatBRL(month.upcoming)}</Sensitive>}
              />
            </StatList>
            {month.byKind.length > 1 ? (
              <StatList>
                {month.byKind.map((item) => (
                  <StatRow
                    key={item.kind}
                    label={DIVIDEND_KIND_LABELS[item.kind]}
                    value={<Sensitive>{formatBRL(item.amount)}</Sensitive>}
                  />
                ))}
              </StatList>
            ) : null}
          </div>
        </MetricCard>
      </div>
    </div>
  );
}

/**
 * Quanto do mês já entrou: a parte recebida na cor dos proventos (--chart-2) e o que falta na
 * mesma cor, mais clara. Embaixo, as duas fatias em % (no celular, elas vão para as linhas).
 */
function MonthProgress({ share }: { share: number }) {
  return (
    <div className="grid gap-2">
      <div
        role="img"
        aria-label={`${formatPercent(share, 0)} do mês já recebido`}
        className="flex h-2 overflow-hidden rounded-full bg-(--chart-2)/25"
      >
        <span className="rounded-full bg-(--chart-2)" style={{ width: `${share * 100}%` }} />
      </div>
      <div className="hidden justify-between text-footnote text-muted-foreground tabular-nums @min-[720px]/month:flex">
        <span>Recebido {formatPercent(share, 0)}</span>
        <span>A receber {formatPercent(1 - share, 0)}</span>
      </div>
    </div>
  );
}
