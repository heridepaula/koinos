import { HandCoinsIcon, PercentIcon, TrendingUpIcon } from "lucide-react";
import { Delta, DeltaChip } from "@/shared/components/delta";
import { MetricCard, Stat, StatList, StatRow } from "@/shared/components/metric";
import { SnapCarousel } from "@/shared/components/snap-carousel";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { Card, CardContent } from "@/shared/ui/card";
import type { AllocationSlice, PortfolioSummary } from "../domain/types";
import { categoryColor } from "./category-colors";
import { ResultBreakdown } from "./result-breakdown";
import { Sensitive } from "@/shared/components/sensitive";

/**
 * Topo do dashboard: o patrimônio (o número principal, em titânio escovado, com a composição da
 * carteira) e três cards de número com a mesma estrutura: azulejo e rótulo, valor em Title 1 e
 * quatro linhas de detalhe no pé, para as linhas se alinharem de card a card sem sobrar espaço.
 */
export function SummaryCards({
  summary,
  byCategory,
}: {
  summary: PortfolioSummary;
  byCategory: AllocationSlice[];
}) {
  const { year } = summary.dividendPace;
  return (
    <div className="grid gap-4 md:gap-6">
      <PatrimonyCard summary={summary} byCategory={byCategory} />
      {/* Três colunas só quando cada card tem uns 300 px: o valor de 28 px não pode quebrar. No
          iPhone, os três cards viram um carrossel com encaixe, para as posições subirem. */}
      <div className="@container">
        <SnapCarousel className="grid gap-4 md:gap-6 @min-[960px]:grid-cols-3">
          <MetricCard
            icon={TrendingUpIcon}
            tile="[--tile:var(--tile-blue)]"
            label="L/P das posições abertas"
            value={<Delta value={summary.pnl} />}
          >
            <StatList>
              <StatRow label="Rentabilidade" value={<Delta pct={summary.pnlPct} />} />
              <StatRow label="Vendas (realizado)" value={<Delta value={summary.realizedPnL} />} />
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
            icon={HandCoinsIcon}
            tile="[--tile:var(--tile-teal)]"
            label="Proventos recebidos"
            value={<Sensitive>{formatBRL(summary.dividendsReceived)}</Sensitive>}
          >
            <StatList>
              <StatRow
                label="Últimos 12 meses"
                value={<Sensitive>{formatBRL(summary.dividendPace.last12m)}</Sensitive>}
              />
              <StatRow
                label="Média por mês (12 meses)"
                value={<Sensitive>{formatBRL(summary.dividendPace.monthlyAverage12m)}</Sensitive>}
              />
              <StatRow
                label={`Em ${year}`}
                value={<Sensitive>{formatBRL(summary.dividendPace.thisYear)}</Sensitive>}
              />
              <StatRow
                label={`Em ${year - 1}`}
                value={<Sensitive>{formatBRL(summary.dividendPace.lastYear)}</Sensitive>}
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
              <StatRow
                label="Renda mensal estimada"
                value={<Sensitive>{formatBRL(summary.monthlyIncome)}</Sensitive>}
              />
              {/* Logo abaixo da renda mensal: a comparação é dela com o que entrou por mês. */}
              <StatRow
                label="Vs. média de 12 meses"
                value={
                  summary.incomeVsAverage === null ? "—" : <Delta pct={summary.incomeVsAverage} />
                }
              />
              <StatRow
                label="Renda anual estimada"
                value={<Sensitive>{formatBRL(summary.monthlyIncome * 12)}</Sensitive>}
              />
              <StatRow
                label="Yield sobre o custo"
                value={summary.yieldOnCost === null ? "—" : formatPercent(summary.yieldOnCost)}
              />
            </StatList>
          </MetricCard>
        </SnapCarousel>
      </div>
    </div>
  );
}

/**
 * O patrimônio: rótulo, o número em Display (Large Title em cards estreitos) e a variação do dia
 * numa cápsula tingida; o investido e o número de ativos; e a composição por categoria. Em card
 * largo, as três partes ficam numa linha, alinhadas pela base, e a composição ocupa o meio. Abaixo
 * disso, o número e os totais dividem a primeira linha e a composição desce para a segunda; no
 * iPhone, tudo empilha.
 */
function PatrimonyCard({
  summary,
  byCategory,
}: {
  summary: PortfolioSummary;
  byCategory: AllocationSlice[];
}) {
  return (
    <Card className="metal-ring card-lift brushed">
      <CardContent className="@container">
        <div className="grid items-end gap-x-12 gap-y-6 @min-[560px]:grid-cols-[minmax(0,1fr)_auto] @min-[960px]:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="grid gap-2">
            <p className="text-subheadline text-muted-foreground">Patrimônio</p>
            <p className="text-large-title tabular-nums @min-[560px]:text-display">
              <Sensitive>{formatBRL(summary.patrimony)}</Sensitive>
            </p>
            <DeltaChip value={summary.dayChange} pct={summary.dayChangePct} suffix="hoje" />
          </div>
          <dl className="grid grid-cols-2 gap-x-10 gap-y-4 @min-[960px]:order-last">
            <Stat label="Investido" value={<Sensitive>{formatBRL(summary.invested)}</Sensitive>} />
            <Stat label="Ativos" value={summary.positionsCount} />
          </dl>
          {byCategory.length > 0 ? (
            <Composition
              slices={byCategory}
              className="@min-[560px]:col-span-2 @min-[960px]:col-span-1"
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Composição da carteira por categoria: uma barra com um trecho por categoria, na cor do donut
 * da alocação, e a legenda com o % de cada uma (a identidade nunca depende só da cor).
 */
function Composition({ slices, className }: { slices: AllocationSlice[]; className?: string }) {
  if (slices.length === 0) return null;
  return (
    <div className={className}>
      <p className="text-footnote text-muted-foreground">Composição</p>
      <div className="mt-2 flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {slices.map((slice) => (
          <span
            key={slice.key}
            className="h-full min-w-1"
            style={{ flex: `${slice.share} 1 0`, background: categoryColor(slice.key) }}
          />
        ))}
      </div>
      <ul
        aria-label="Composição por categoria"
        className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-footnote"
      >
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: categoryColor(slice.key) }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{slice.label.replace(/^FII /, "")}</span>
            <span className="font-medium tabular-nums">
              {slice.share > 0 && slice.share < 0.005 ? "<1%" : formatPercent(slice.share, 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
