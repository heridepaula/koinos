import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import {
  getAssetClasses,
  getAssetSnapshots,
  type AssetSnapshot,
} from "@/features/market-data/server";
import { getMyTargetAssets } from "@/features/strategy/server";
import { traced } from "@/shared/lib/tracing";
import { priceSeries } from "../domain/asset-overview";
import type { AssetWatchlist, WatchlistRow } from "../domain/types";
import { getPortfolioSnapshot } from "./snapshot";

/** Os fechamentos diários recentes terminando no preço atual: o minigráfico da lista. */
function sparkOf(asset: AssetSnapshot | undefined): number[] {
  if (!asset) return [];
  const { price, quoteFetchedAt } = asset;
  return priceSeries({
    monthlyCloses: new Map(),
    recentCloses: asset.recentCloses,
    quote: price !== null && quoteFetchedAt ? { price, at: quoteFetchedAt } : null,
  }).daily.map((point) => point.close);
}

/**
 * A lista de `/ativos`: as posições abertas (da maior para a menor) e os ativos da estratégia que o
 * dono ainda não tem (na ordem do ranking), FIIs e ações juntos. Só dados já guardados.
 */
export const getAssetWatchlist = cache(
  traced(
    "view.asset-watchlist",
    async (): Promise<AssetWatchlist> => {
      await connection();
      const [snapshot, targets] = await Promise.all([
        getPortfolioSnapshot("TODOS"),
        getMyTargetAssets(),
      ]);
      const held = [...snapshot.positions].sort((a, b) => b.currentValue - a.currentValue);
      const heldTickers = new Set(held.map((row) => row.ticker));
      const target = targets
        .filter((item) => item.inStrategy && !heldTickers.has(item.ticker))
        .sort(
          (a, b) =>
            (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY) ||
            a.ticker.localeCompare(b.ticker),
        );
      const tickers = [...heldTickers, ...target.map((item) => item.ticker)];
      const [assets, classes] = await Promise.all([
        getAssetSnapshots(tickers),
        getAssetClasses(tickers),
      ]);
      const rowOf = (ticker: string): WatchlistRow => {
        const asset = assets.get(ticker);
        return {
          ticker,
          name: asset?.name ?? null,
          logoUrl: asset?.logoUrl ?? null,
          assetClass: classes.get(ticker) ?? null,
          price: asset?.price ?? null,
          changePercent: asset?.changePercent ?? null,
          spark: sparkOf(asset),
        };
      };
      return {
        held: held.map((row) => rowOf(row.ticker)),
        target: target.map((item) => rowOf(item.ticker)),
      };
    },
    (watchlist) => ({
      "koinos.view.positions": watchlist.held.length,
      "koinos.view.strategy_rows": watchlist.target.length,
    }),
  ),
);
