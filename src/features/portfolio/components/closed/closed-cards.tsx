import { Delta } from "@/shared/components/delta";
import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { FII_CAPITAL_GAINS_RATE } from "../../domain/closed-positions";
import type { ClosedPositionsTotals } from "../../domain/types";

/** Cards do topo: o resultado das vendas, o IR estimado e quantas posições deram lucro ou prejuízo. */
export function ClosedPositionsCards({ totals }: { totals: ClosedPositionsTotals }) {
  return (
    <div className="@container">
      <div className="grid gap-4 @min-[720px]:grid-cols-3">
        <Card className="card-lift">
          <CardHeader>
            <CardDescription>Resultado das vendas</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              <Delta value={totals.realizedPnL} />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground">
            <span>
              Vendido{" "}
              <span className="text-foreground tabular-nums">{formatBRL(totals.proceeds)}</span>
            </span>
            <span>
              Custo (PM){" "}
              <span className="text-foreground tabular-nums">{formatBRL(totals.costBasis)}</span>
            </span>
          </CardContent>
        </Card>
        <Card className="card-lift">
          <CardHeader>
            <CardDescription>
              IR estimado ({formatPercent(FII_CAPITAL_GAINS_RATE, 0)} do lucro)
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatBRL(totals.estimatedTax)}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground">
            <span>Por posição, sem isenção.</span>
            <span>Sem compensar os prejuízos.</span>
          </CardContent>
        </Card>
        <Card className="card-lift">
          <CardHeader>
            <CardDescription>Posições encerradas</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatQuantity(totals.count)}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground">
            <span>
              {totals.withProfit} com lucro <Delta value={totals.profit} />
            </span>
            <span>
              {totals.withLoss} com prejuízo <Delta value={totals.loss} />
            </span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
