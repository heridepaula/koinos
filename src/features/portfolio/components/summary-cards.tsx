import { HandCoinsIcon, PercentIcon, TrendingUpIcon } from "lucide-react";
import { Delta, DeltaChip } from "@/shared/components/delta";
import { MetricCard, Stat, StatList, StatRow } from "@/shared/components/metric";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { Card, CardContent } from "@/shared/ui/card";
import type { PortfolioSummary } from "../domain/types";
import { ResultBreakdown } from "./result-breakdown";

/**
 * Topo do dashboard: o patrimônio (o número principal, em titânio escovado) e três cards de
 * número com a mesma estrutura: azulejo e rótulo, valor em Title 1 e a lista de detalhes no pé.
 */
export function SummaryCards({ summary }: { summary: PortfolioSummary }) {
  const { year } = summary.dividendPace;
  return (
    <div className="grid gap-4 md:gap-6">
      <PatrimonyCard summary={summary} />
      {/* Três colunas só quando cada card tem uns 300 px: o valor de 28 px não pode quebrar. */}
      <div className="@container">
        <div className="grid gap-4 md:gap-6 @min-[960px]:grid-cols-3">
          <MetricCard
            icon={TrendingUpIcon}
            tile="[--tile:var(--tile-blue)]"
            label="Lucro/Prejuízo das posições abertas"
            value={<Delta value={summary.pnl} />}
          >
            <StatList>
              <StatRow label="Rentabilidade" value={<Delta pct={summary.pnlPct} />} />
              <StatRow label="Realizado nas vendas" value={<Delta value={summary.realizedPnL} />} />
            </StatList>
          </MetricCard>
          <MetricCard
            icon={HandCoinsIcon}
            tile="[--tile:var(--tile-teal)]"
            label="Proventos recebidos"
            value={formatBRL(summary.dividendsReceived)}
          >
            <StatList>
              <StatRow
                label="Média por mês (12 meses)"
                value={formatBRL(summary.dividendPace.monthlyAverage12m)}
              />
              <StatRow label={`Em ${year}`} value={formatBRL(summary.dividendPace.thisYear)} />
              <StatRow label={`Em ${year - 1}`} value={formatBRL(summary.dividendPace.lastYear)} />
              <StatRow
                label="L/P com proventos"
                value={<Delta value={summary.pnlWithDividends} />}
              />
              <StatRow
                label={
                  <ResultBreakdown
                    pnl={summary.pnl}
                    dividends={summary.dividendsReceived}
                    withDividends={summary.pnlWithDividends}
                    realized={summary.realizedPnL}
                    total={summary.totalResult}
                  />
                }
                value={<Delta value={summary.totalResult} />}
              />
            </StatList>
          </MetricCard>
          <MetricCard
            icon={PercentIcon}
            tile="[--tile:var(--tile-indigo)]"
            label="Dividend yield em 12 meses"
            value={summary.dy12m === null ? "—" : formatPercent(summary.dy12m)}
          >
            <StatList>
              <StatRow label="Renda mensal estimada" value={formatBRL(summary.monthlyIncome)} />
            </StatList>
          </MetricCard>
        </div>
      </div>
    </div>
  );
}

/**
 * O patrimônio: rótulo, o número em Display (Large Title em cards estreitos) e a variação do dia
 * numa cápsula tingida. À direita, o investido e o número de ativos, alinhados pela base.
 */
function PatrimonyCard({ summary }: { summary: PortfolioSummary }) {
  return (
    <Card className="metal-ring card-lift brushed">
      <CardContent className="@container">
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
          <div className="grid gap-2">
            <p className="text-subheadline text-muted-foreground">Patrimônio</p>
            <p className="text-large-title tabular-nums @min-[560px]:text-display">
              {formatBRL(summary.patrimony)}
            </p>
            <DeltaChip value={summary.dayChange} pct={summary.dayChangePct} suffix="hoje" />
          </div>
          <dl className="grid grid-cols-2 gap-x-10 gap-y-4">
            <Stat label="Investido" value={formatBRL(summary.invested)} />
            <Stat label="Ativos" value={summary.positionsCount} />
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}
