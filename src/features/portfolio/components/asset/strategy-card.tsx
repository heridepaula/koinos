import Link from "next/link";
import { PriorityBadge } from "@/features/smart-buy/ui";
import { BIAS_LABELS } from "@/features/strategy";
import { CeilingCheckIcon } from "@/features/strategy/ui";
import { MetricCard, StatList, StatRow } from "@/shared/components/metric";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import type { AssetOverview } from "../../domain/types";

const EMPTY = "—";

/** Estratégia (Carteira Alvo): teto, margem, viés, prioridade e peso. Só leitura. */
export function StrategyCard({ overview }: { overview: AssetOverview }) {
  const row = overview.strategy;
  if (!row) return null;
  const tab = overview.assetClass === "ACAO" ? "acoes" : "fiis";
  const currentWeight = overview.position?.strategyWeight ?? null;
  return (
    <MetricCard label="Estratégia" value={row.rank === null ? EMPTY : `#${row.rank}`}>
      <StatList>
        <StatRow
          label="Preço teto"
          value={
            <span className="inline-flex items-center gap-2">
              {row.ceilingPrice === null ? (
                EMPTY
              ) : (
                <Sensitive>{formatBRL(row.ceilingPrice)}</Sensitive>
              )}
              {row.ceilingCheck && row.ceilingPrice !== null ? (
                <CeilingCheckIcon
                  check={row.ceilingCheck}
                  ceiling={row.ceilingPrice}
                  price={row.price}
                />
              ) : null}
            </span>
          }
        />
        <StatRow
          label="Margem até o teto"
          value={row.marginToCeiling === null ? EMPTY : formatPercent(row.marginToCeiling)}
        />
        <StatRow label="Viés" value={row.bias ? BIAS_LABELS[row.bias] : EMPTY} />
        <StatRow label="Prioridade no aporte" value={<PriorityBadge priority={row.priority} />} />
        <StatRow
          label="Peso atual × alvo"
          value={`${currentWeight === null ? EMPTY : formatPercent(currentWeight)} × ${row.targetWeight === null ? EMPTY : formatPercent(row.targetWeight)}`}
        />
      </StatList>
      <div className="mt-3">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/carteira-alvo?classe=${tab}`} />}
        >
          Editar na Carteira Alvo
        </Button>
      </div>
    </MetricCard>
  );
}
