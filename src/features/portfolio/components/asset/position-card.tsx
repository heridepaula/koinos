import Link from "next/link";
import { Delta } from "@/shared/components/delta";
import { MetricCard, StatList, StatRow } from "@/shared/components/metric";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatPercent, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import type { AssetOverview } from "../../domain/types";

const EMPTY = "—";

/** Minha posição: aberta (quantidade, resultado, YOC) ou encerrada (resultado das vendas). */
export function PositionCard({ overview }: { overview: AssetOverview }) {
  const { position, closed, yoc } = overview;
  if (position) {
    return (
      <MetricCard
        label="Minha posição"
        value={<Sensitive>{formatBRL(position.currentValue)}</Sensitive>}
      >
        <StatList>
          <StatRow
            label="Quantidade"
            value={<Sensitive mask="•••">{formatQuantity(position.quantity)}</Sensitive>}
          />
          <StatRow
            label="Preço médio"
            value={<Sensitive>{formatBRL(position.averagePrice)}</Sensitive>}
          />
          <StatRow
            label="Investido"
            value={<Sensitive>{formatBRL(position.totalCost)}</Sensitive>}
          />
          <StatRow label="L/P" value={<Delta value={position.pnl} pct={position.pnlPct} />} />
          <StatRow
            label="Proventos recebidos"
            value={<Sensitive>{formatBRL(position.dividends)}</Sensitive>}
          />
          <StatRow label="L/P com proventos" value={<Delta value={position.pnlWithDividends} />} />
          <StatRow
            label="Yield on cost (12 meses)"
            value={yoc === null ? EMPTY : formatPercent(yoc)}
          />
        </StatList>
      </MetricCard>
    );
  }
  if (!closed) return null;
  return (
    <MetricCard label="Posição encerrada" value={<Delta value={closed.totalResult} />}>
      <StatList>
        <StatRow
          label="Encerrada em"
          value={closed.closedAt ? formatTradeDate(closed.closedAt) : EMPTY}
        />
        <StatRow label="Resultado das vendas" value={<Delta value={closed.realizedPnL} />} />
        <StatRow
          label="Proventos recebidos"
          value={<Sensitive>{formatBRL(closed.dividends)}</Sensitive>}
        />
      </StatList>
      <div className="mt-3">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/encerradas" />}
        >
          Ver posições encerradas
        </Button>
      </div>
    </MetricCard>
  );
}
