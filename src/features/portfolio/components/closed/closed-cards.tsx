import {
  ArchiveIcon,
  ArrowRightIcon,
  ReceiptTextIcon,
  ScaleIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";
import Link from "next/link";
import { Delta } from "@/shared/components/delta";
import { MetricCard, MetricNote, StatList, StatRow } from "@/shared/components/metric";
import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { FII_CAPITAL_GAINS_RATE } from "../../domain/closed-positions";
import type { ClosedPositionsTotals } from "../../domain/types";

const positions = (count: number) => `${count} ${count === 1 ? "posição" : "posições"}`;
const taxLabel = `IR estimado (${formatPercent(FII_CAPITAL_GAINS_RATE, 0)} do lucro)`;

/** Cards de /encerradas: o resultado das vendas, as posições e o atalho para o IR estimado. */
export function ClosedPositionsCards({ totals }: { totals: ClosedPositionsTotals }) {
  return (
    <div className="@container">
      <div className="grid gap-4 md:gap-6 @min-[720px]:grid-cols-3">
        <MetricCard
          icon={ScaleIcon}
          tile="[--tile:var(--tile-blue)]"
          label="Resultado das vendas"
          value={<Delta value={totals.realizedPnL} />}
        >
          <StatList>
            <StatRow label="Vendido" value={formatBRL(totals.proceeds)} />
            <StatRow label="Custo (PM)" value={formatBRL(totals.costBasis)} />
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
          value={formatBRL(totals.estimatedTax)}
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

/** Cards de /encerradas/ir: o IR estimado, a base (lucro) e o prejuízo que ficou sem compensar. */
export function ClosedTaxCards({ totals }: { totals: ClosedPositionsTotals }) {
  return (
    <div className="@container">
      <div className="grid gap-4 md:gap-6 @min-[720px]:grid-cols-3">
        <MetricCard
          icon={ReceiptTextIcon}
          tile="[--tile:var(--tile-indigo)]"
          label={taxLabel}
          value={formatBRL(totals.estimatedTax)}
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
