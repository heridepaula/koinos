import { ArchiveIcon, WalletIcon } from "lucide-react";
import { Delta } from "@/shared/components/delta";
import { MetricCard, StatList, StatRow } from "@/shared/components/metric";
import { QUANTITY_MASK, Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatPercent, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import type { AssetOverview } from "../../domain/types";
import { CardLink } from "./card-link";

const EMPTY = "—";

/**
 * Minha posição: o valor de hoje, o resultado e o que ela já pagou (com o yield on cost). Numa
 * posição zerada, o resultado das vendas e o atalho para as encerradas.
 */
export function PositionCard({
  overview,
  className,
}: {
  overview: AssetOverview;
  className?: string;
}) {
  const { position, closed, yoc, assetClass } = overview;
  if (position) {
    const unit = assetClass === "ACAO" ? "ações" : "cotas";
    return (
      <MetricCard
        icon={WalletIcon}
        tile="[--tile:var(--tile-blue)]"
        label="Minha posição"
        value={<Sensitive>{formatBRL(position.currentValue)}</Sensitive>}
        className={className}
      >
        <StatList>
          <StatRow label="Resultado" value={<Delta value={position.pnl} pct={position.pnlPct} />} />
          <StatRow
            label="Quantidade"
            value={
              <>
                <Sensitive mask={QUANTITY_MASK}>{formatQuantity(position.quantity)}</Sensitive>{" "}
                <span className="font-normal text-muted-foreground">{unit}</span>
              </>
            }
          />
          <StatRow
            label="Preço médio"
            value={<Sensitive>{formatBRL(position.averagePrice)}</Sensitive>}
          />
          <StatRow
            label="Investido"
            value={<Sensitive>{formatBRL(position.totalCost)}</Sensitive>}
          />
          <StatRow
            label="Proventos recebidos"
            value={<Sensitive>{formatBRL(position.dividends)}</Sensitive>}
          />
          <StatRow
            label="Resultado com proventos"
            value={<Delta value={position.pnlWithDividends} />}
          />
          <StatRow
            label="Yield on cost, 12 meses"
            value={yoc === null ? EMPTY : formatPercent(yoc)}
          />
        </StatList>
      </MetricCard>
    );
  }
  if (!closed) return null;
  return (
    <MetricCard
      icon={ArchiveIcon}
      tile="[--tile:var(--tile-pink)]"
      label="Posição encerrada"
      value={<Delta value={closed.totalResult} />}
      className={cn("flex flex-col", className)}
    >
      <StatList>
        <StatRow
          label="Zerada em"
          value={closed.closedAt ? formatTradeDate(closed.closedAt) : EMPTY}
        />
        <StatRow label="Resultado das vendas" value={<Delta value={closed.realizedPnL} />} />
        <StatRow
          label="Proventos recebidos"
          value={<Sensitive>{formatBRL(closed.dividends)}</Sensitive>}
        />
      </StatList>
      <CardLink href="/encerradas">Ver posições encerradas</CardLink>
    </MetricCard>
  );
}
