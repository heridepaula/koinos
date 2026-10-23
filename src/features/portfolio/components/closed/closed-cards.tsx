import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Delta } from "@/shared/components/delta";
import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { FII_CAPITAL_GAINS_RATE } from "../../domain/closed-positions";
import type { ClosedPositionsTotals } from "../../domain/types";

const positions = (count: number) => `${count} ${count === 1 ? "posição" : "posições"}`;

/** Cards de /encerradas: o resultado das vendas, as posições e o atalho para o IR estimado. */
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
        <Card className="card-lift">
          <CardHeader>
            <CardDescription>
              IR estimado ({formatPercent(FII_CAPITAL_GAINS_RATE, 0)} do lucro)
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatBRL(totals.estimatedTax)}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Cards de /encerradas/ir: o IR estimado, a base (lucro) e o prejuízo que ficou sem compensar. */
export function ClosedTaxCards({ totals }: { totals: ClosedPositionsTotals }) {
  return (
    <div className="@container">
      <div className="grid gap-4 @min-[720px]:grid-cols-3">
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
            <CardDescription>Lucro tributável</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              <Delta value={totals.profit} />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {positions(totals.withProfit)} com lucro: a base do IR.
          </CardContent>
        </Card>
        <Card className="card-lift">
          <CardHeader>
            <CardDescription>Prejuízo</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              <Delta value={totals.loss} />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {positions(totals.withLoss)} com prejuízo: não paga IR, e aqui não abate o lucro das
            outras.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
