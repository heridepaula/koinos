import { AssetSearch } from "@/features/market-data/ui";
import { AssetLabel } from "@/shared/components/asset-label";
import { Delta } from "@/shared/components/delta";
import { formatBRL } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import type { AssetOverview } from "../../domain/types";

const CLASS_LABEL = { FII: "FII", ACAO: "Ação" } as const;

/** Cabeçalho do ativo: nome, classe, cotação do dia e a busca para trocar de ativo. */
export function AssetHero({ overview }: { overview: AssetOverview }) {
  const { ticker, name, logoUrl, assetClass, price, dailyChange } = overview;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <div className="grid gap-2">
        <div className="flex items-center gap-3">
          <AssetLabel ticker={ticker} name={name} logoUrl={logoUrl} size="lg" />
          {assetClass ? <Badge variant="secondary">{CLASS_LABEL[assetClass]}</Badge> : null}
        </div>
        <div className="flex items-baseline gap-3 tabular-nums">
          <span className="text-title-1">{price === null ? "Sem cotação" : formatBRL(price)}</span>
          {dailyChange ? (
            <Delta value={dailyChange.amount} pct={dailyChange.percent / 100} />
          ) : null}
        </div>
      </div>
      <div className="w-full md:w-auto md:min-w-80">
        <AssetSearch />
      </div>
    </div>
  );
}
