import { Delta } from "@/shared/components/delta";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type { PortfolioSummary } from "../domain/types";

export function SummaryCards({ summary }: { summary: PortfolioSummary }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {/* Número principal do dashboard: o patrimônio, em titânio escovado. */}
      <Card className="metal-ring card-lift brushed md:col-span-2">
        <CardHeader>
          <CardDescription>Patrimônio</CardDescription>
          <CardTitle className="text-4xl font-semibold tracking-tight tabular-nums md:text-5xl">
            {formatBRL(summary.patrimony)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>
            Hoje <Delta value={summary.dayChange} pct={summary.dayChangePct} />
          </span>
          <span>
            Investido{" "}
            <span className="text-foreground tabular-nums">{formatBRL(summary.invested)}</span>
          </span>
          <span>{summary.positionsCount} ativos</span>
        </CardContent>
      </Card>

      <Card className="card-lift">
        <CardHeader>
          <CardDescription>Lucro/Prejuízo (posições abertas)</CardDescription>
          <CardTitle className="text-2xl font-semibold">
            <Delta value={summary.pnl} />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm text-muted-foreground">
          <span>
            Rentabilidade <Delta pct={summary.pnlPct} />
          </span>
          <span>
            Realizado (vendas) <Delta value={summary.realizedPnL} />
          </span>
        </CardContent>
      </Card>

      <Card className="card-lift">
        <CardHeader>
          <CardDescription>Dividend yield 12 meses</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {summary.dy12m === null ? "—" : formatPercent(summary.dy12m)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Renda mensal estimada{" "}
          <span className="text-foreground tabular-nums">{formatBRL(summary.monthlyIncome)}</span>
        </CardContent>
      </Card>
    </div>
  );
}
