import {
  ArchiveIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  ReceiptTextIcon,
  ScaleIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";
import Link from "next/link";
import { Delta } from "@/shared/components/delta";
import { InsetGroup, insetRowClass } from "@/shared/components/inset-list";
import { MetricCard, MetricNote, StatList, StatRow } from "@/shared/components/metric";
import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { FII_CAPITAL_GAINS_RATE } from "../../domain/closed-positions";
import type { ClosedPositionsTotals } from "../../domain/types";
import { Sensitive } from "@/shared/components/sensitive";

const positions = (count: number) => `${count} ${count === 1 ? "posição" : "posições"}`;
const taxLabel = `IR estimado (${formatPercent(FII_CAPITAL_GAINS_RATE, 0)} do lucro)`;

/**
 * Cards de /encerradas: o resultado das vendas, as posições e o atalho para o IR estimado. No
 * card estreito (o celular), um card só com o resultado e as contagens, e o IR numa célula com
 * chevron, como uma subpágina dos Ajustes.
 */
export function ClosedPositionsCards({ totals }: { totals: ClosedPositionsTotals }) {
  return (
    <div className="@container/closed">
      <div className="grid gap-4 @min-[720px]/closed:hidden">
        <MetricCard
          icon={ScaleIcon}
          tile="[--tile:var(--tile-blue)]"
          label="Resultado das vendas"
          value={<Delta value={totals.realizedPnL} />}
        >
          <StatList>
            <StatRow label="Vendido" value={<Sensitive>{formatBRL(totals.proceeds)}</Sensitive>} />
            <StatRow
              label="Custo (PM)"
              value={<Sensitive>{formatBRL(totals.costBasis)}</Sensitive>}
            />
            <StatRow
              label={`${totals.withProfit} com lucro`}
              value={<Delta value={totals.profit} />}
            />
            <StatRow
              label={`${totals.withLoss} com prejuízo`}
              value={<Delta value={totals.loss} />}
            />
          </StatList>
        </MetricCard>
        <InsetGroup surface="page">
          <Link href="/encerradas/ir" className={insetRowClass()}>
            <span className="tile size-8 rounded-lg [--tile:var(--tile-indigo)] [&_svg]:size-4.5">
              <ReceiptTextIcon aria-hidden="true" />
            </span>
            <span className="grid flex-1">
              IR estimado
              <span className="text-footnote text-muted-foreground">
                {formatPercent(FII_CAPITAL_GAINS_RATE, 0)} do lucro de cada FII
              </span>
            </span>
            <span className="text-muted-foreground tabular-nums">
              <Sensitive>{formatBRL(totals.estimatedTax)}</Sensitive>
            </span>
            <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        </InsetGroup>
      </div>
      <div className="hidden gap-4 md:gap-6 @min-[720px]/closed:grid @min-[720px]/closed:grid-cols-3">
        <MetricCard
          icon={ScaleIcon}
          tile="[--tile:var(--tile-blue)]"
          label="Resultado das vendas"
          value={<Delta value={totals.realizedPnL} />}
        >
          <StatList>
            <StatRow label="Vendido" value={<Sensitive>{formatBRL(totals.proceeds)}</Sensitive>} />
            <StatRow
              label="Custo (PM)"
              value={<Sensitive>{formatBRL(totals.costBasis)}</Sensitive>}
            />
          </StatList>
        </MetricCard>
        <MetricCard
          icon={ArchiveIcon}
          tile="[--tile:var(--tile-pink)]"
          label="Posições encerradas"
          value={formatQuantity(totals.count)}
        >
          <StatList>
            <StatRow
              label={`${totals.withProfit} com lucro`}
              value={<Delta value={totals.profit} />}
            />
            <StatRow
              label={`${totals.withLoss} com prejuízo`}
              value={<Delta value={totals.loss} />}
            />
          </StatList>
        </MetricCard>
        <MetricCard
          icon={ReceiptTextIcon}
          tile="[--tile:var(--tile-indigo)]"
          label={taxLabel}
          value={<Sensitive>{formatBRL(totals.estimatedTax)}</Sensitive>}
        >
          <div className="border-t border-border/70 pt-3">
            {/* Outline, não link: o azul do link fica abaixo de 4,5:1 sobre o card. */}
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/encerradas/ir" />}
            >
              IR por FII
              <ArrowRightIcon />
            </Button>
          </div>
        </MetricCard>
      </div>
    </div>
  );
}

/**
 * Cards de /encerradas/ir: o IR estimado, a base (lucro) e o prejuízo que ficou sem compensar. No
 * card estreito (o celular), um card só: o IR e, nas linhas, o lucro e o prejuízo.
 */
export function ClosedTaxCards({ totals }: { totals: ClosedPositionsTotals }) {
  return (
    <div className="@container/closed">
      <MetricCard
        icon={ReceiptTextIcon}
        tile="[--tile:var(--tile-indigo)]"
        label={taxLabel}
        value={<Sensitive>{formatBRL(totals.estimatedTax)}</Sensitive>}
        className="@min-[720px]/closed:hidden"
      >
        <div className="grid gap-3">
          <StatList>
            <StatRow
              label={`Lucro tributável · ${positions(totals.withProfit)}`}
              value={<Delta value={totals.profit} />}
            />
            <StatRow
              label={`Prejuízo · ${positions(totals.withLoss)}`}
              value={<Delta value={totals.loss} />}
            />
          </StatList>
          <p className="text-footnote text-muted-foreground">
            Por posição, sem isenção e sem compensar os prejuízos.
          </p>
        </div>
      </MetricCard>
      <div className="hidden gap-4 md:gap-6 @min-[720px]/closed:grid @min-[720px]/closed:grid-cols-3">
        <MetricCard
          icon={ReceiptTextIcon}
          tile="[--tile:var(--tile-indigo)]"
          label={taxLabel}
          value={<Sensitive>{formatBRL(totals.estimatedTax)}</Sensitive>}
        >
          <MetricNote>Por posição, sem isenção e sem compensar os prejuízos.</MetricNote>
        </MetricCard>
        <MetricCard
          icon={TrendingUpIcon}
          tile="[--tile:var(--tile-green)]"
          label="Lucro tributável"
          value={<Delta value={totals.profit} />}
        >
          <MetricNote>{positions(totals.withProfit)} com lucro: a base do IR.</MetricNote>
        </MetricCard>
        <MetricCard
          icon={TrendingDownIcon}
          tile="[--tile:var(--tile-pink)]"
          label="Prejuízo"
          value={<Delta value={totals.loss} />}
        >
          <MetricNote>
            {positions(totals.withLoss)} com prejuízo: não paga IR, e aqui não abate o lucro das
            outras.
          </MetricNote>
        </MetricCard>
      </div>
    </div>
  );
}
