import { MetricCard, StatList, StatRow } from "@/shared/components/metric";
import { formatBRL, formatPercent, formatTradeDate } from "@/shared/lib/format";
import type { AssetOverview } from "../../domain/types";

const EMPTY = "—";

/** Mercado: só o que o app já guarda do ativo (nenhuma busca sob demanda). */
export function MarketCard({ overview }: { overview: AssetOverview }) {
  const { market, assetClass } = overview;
  const dy = market.dy12m === null ? EMPTY : formatPercent(market.dy12m);
  return (
    <MetricCard label="Mercado" value={dy}>
      <StatList>
        <StatRow label="DY 12 meses" value={dy} />
        <StatRow
          label="P/VP"
          value={
            market.priceToBook === null ? EMPTY : market.priceToBook.toFixed(2).replace(".", ",")
          }
        />
        <StatRow
          label="Último provento"
          value={
            market.lastDividend
              ? `${formatBRL(market.lastDividend.amount)} · ex ${formatTradeDate(market.lastDividend.exDate)}`
              : EMPTY
          }
        />
        {assetClass === "FII" ? <StatRow label="Segmento" value={market.segment ?? EMPTY} /> : null}
        <StatRow
          label="Cotação de"
          value={market.quoteFetchedAt ? formatTradeDate(market.quoteFetchedAt) : EMPTY}
        />
      </StatList>
    </MetricCard>
  );
}
