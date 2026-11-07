import { dayChangeLabel, type MarketSession } from "@/features/market-data";
import { AssetLabel } from "@/shared/components/asset-label";
import { Delta, DeltaChip } from "@/shared/components/delta";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import type { DayMover, DayMovers as DayMoversData } from "../domain/types";
import { MarketStatus } from "./market-status";

/**
 * As 3 maiores altas e as 3 maiores baixas do pregão entre as posições abertas, lado a lado a
 * partir de 560 px de card. Fora do pregão de hoje, o título diz de que dia é a variação.
 */
export function DayMovers({ movers, market }: { movers: DayMoversData; market: MarketSession }) {
  if (market.sessionDate === null) return null;
  const title = market.today
    ? "Altas e baixas de hoje"
    : `Altas e baixas ${dayChangeLabel(market)}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardAction>
          <MarketStatus open={market.open} />
        </CardAction>
      </CardHeader>
      <CardContent className="@container">
        <div className="grid gap-6 @min-[560px]:grid-cols-2 @min-[560px]:gap-10">
          <MoverList title="Maiores altas" rows={movers.gainers} empty="Nenhuma alta no pregão." />
          <MoverList title="Maiores baixas" rows={movers.losers} empty="Nenhuma baixa no pregão." />
        </div>
      </CardContent>
    </Card>
  );
}

function MoverList({ title, rows, empty }: { title: string; rows: DayMover[]; empty: string }) {
  return (
    <section className="grid content-start gap-2">
      <h3 className="text-subheadline font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-footnote text-muted-foreground">{empty}</p>
      ) : (
        <ol className="grid divide-y divide-border">
          {rows.map((row) => (
            <li key={row.ticker} className="flex items-center justify-between gap-3 py-2.5">
              <AssetLabel
                ticker={row.ticker}
                name={row.name}
                logoUrl={row.logoUrl}
                href={`/ativos/${row.ticker}`}
              />
              <div className="grid shrink-0 justify-items-end gap-0.5">
                <DeltaChip pct={row.changePercent} className="h-6 px-2" />
                <Delta value={row.amount} className="text-footnote" />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
