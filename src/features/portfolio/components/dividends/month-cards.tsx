import { CircleCheckIcon, ClockIcon, HandCoinsIcon } from "lucide-react";
import { MetricCard } from "@/shared/components/metric";
import { formatBRL, formatMonth, formatPercent } from "@/shared/lib/format";
import type { DividendMonthSummary } from "../../domain/types";

/**
 * Mês atual em três cards de número: o que já caiu (extrato da B3), o que falta cair (a lista da
 * B3 ou, sem ela, os anúncios do Yahoo) e o total, que mostra numa barra quanto do mês já entrou.
 */
export function DividendMonthCards({
  month,
  forecastAsOf,
}: {
  month: DividendMonthSummary;
  forecastAsOf: Date | null;
}) {
  return (
    // Três colunas só quando cada card tem espaço para o valor sem quebrar a linha.
    <div className="@container">
      <div className="grid gap-4 md:gap-6 @min-[720px]:grid-cols-3">
        <MetricCard
          icon={CircleCheckIcon}
          tile="[--tile:var(--tile-green)]"
          label={`Recebido em ${formatMonth(month.month)}`}
          value={formatBRL(month.received)}
        />
        <MetricCard
          icon={ClockIcon}
          tile="[--tile:var(--tile-orange)]"
          label={forecastAsOf ? "A receber" : "A receber (estimado)"}
          value={formatBRL(month.upcoming)}
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
          label="Total do mês"
          value={formatBRL(month.total)}
          className="metal-ring brushed"
        >
          <MonthProgress received={month.received} total={month.total} />
        </MetricCard>
      </div>
    </div>
  );
}

/**
 * Quanto do mês já entrou: a parte recebida na cor dos proventos (--chart-2) e o que falta na
 * mesma cor, mais clara. Embaixo, as duas fatias em %.
 */
function MonthProgress({ received, total }: { received: number; total: number }) {
  const share = total > 0 ? Math.min(1, received / total) : 0;
  return (
    <div className="grid gap-2">
      <div
        role="img"
        aria-label={`${formatPercent(share, 0)} do mês já recebido`}
        className="flex h-2 overflow-hidden rounded-full bg-(--chart-2)/25"
      >
        <span className="rounded-full bg-(--chart-2)" style={{ width: `${share * 100}%` }} />
      </div>
      <div className="flex justify-between text-footnote text-muted-foreground tabular-nums">
        <span>Recebido {formatPercent(share, 0)}</span>
        <span>A receber {formatPercent(1 - share, 0)}</span>
      </div>
    </div>
  );
}
