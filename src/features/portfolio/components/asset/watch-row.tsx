import Link from "next/link";
import type { ReactNode } from "react";
import { AssetLabel } from "@/shared/components/asset-label";
import { DeltaChip } from "@/shared/components/delta";
import { Sparkline } from "@/shared/components/sparkline";
import { formatBRL } from "@/shared/lib/format";
import type { WatchlistRow } from "../../domain/types";

const ROW_CLASS =
  "flex min-h-16 items-center gap-3 rounded-xl px-3 py-2 outline-none transition-colors duration-150 select-none [-webkit-touch-callout:none] hover:bg-foreground/5 focus-visible:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-foreground/8";

/** Uma linha que abre o ativo: o logo, o ticker e o nome, e o que vai à direita. */
function RowLink({
  ticker,
  name,
  logoUrl,
  children,
}: {
  ticker: string;
  name: string | null;
  logoUrl: string | null;
  children: ReactNode;
}) {
  return (
    <Link href={`/ativos/${ticker}`} className={ROW_CLASS} data-finder-item="">
      <div className="min-w-0 flex-1">
        <AssetLabel ticker={ticker} name={name} logoUrl={logoUrl} size="lg" />
      </div>
      {children}
    </Link>
  );
}

/**
 * Linha da lista de ativos, como a do app Bolsa: o minigráfico das últimas semanas, o preço e a
 * variação do dia numa cápsula.
 */
export function WatchRow({ row }: { row: WatchlistRow }) {
  return (
    <RowLink ticker={row.ticker} name={row.name} logoUrl={row.logoUrl}>
      <Sparkline values={row.spark} className="shrink-0 text-muted-foreground max-[379px]:hidden" />
      <div className="grid w-24 shrink-0 justify-items-end gap-1 text-right">
        <span className="text-headline tabular-nums">
          {row.price === null ? "—" : formatBRL(row.price)}
        </span>
        {row.changePercent === null ? (
          <span className="text-footnote text-muted-foreground">—</span>
        ) : (
          <DeltaChip pct={row.changePercent / 100} className="h-6 px-2" />
        )}
      </div>
    </RowLink>
  );
}

/** Resultado do catálogo da B3: um ativo fora da carteira e da Carteira Alvo (sem cotação guardada). */
export function CatalogRow({
  ticker,
  name,
  logoUrl,
  kind,
}: {
  ticker: string;
  name: string;
  logoUrl: string | null;
  kind: "FII" | "Ação";
}) {
  return (
    <RowLink ticker={ticker} name={name !== ticker ? name : null} logoUrl={logoUrl}>
      <span className="shrink-0 text-footnote text-muted-foreground">{kind}</span>
    </RowLink>
  );
}
