import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import type { AssetOverview } from "../../domain/types";

const CLASS_LABEL = { FII: "FII", ACAO: "Ação" } as const;

/**
 * Cabeçalho do ativo, como o do app Bolsa: o ticker é o título grande (e o compacto das barras do
 * topo, por `data-page-title`), com o logo ao lado e, embaixo, o nome, a classe e o segmento.
 */
export function AssetHeader({
  overview,
  actions,
}: {
  overview: AssetOverview;
  /** Ações da mesa (no iPhone ficam na barra e no botão ao lado da tab bar). */
  actions?: ReactNode;
}) {
  const { ticker, name, logoUrl, assetClass, market } = overview;
  const kind = [assetClass ? CLASS_LABEL[assetClass] : null, market.segment]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 items-center gap-3 md:gap-4">
        <Avatar className="size-12 rounded-[12px] md:size-14 md:rounded-[14px]">
          {logoUrl ? <AvatarImage src={logoUrl} alt="" referrerPolicy="no-referrer" /> : null}
          <AvatarFallback className="rounded-[12px] text-headline text-foreground md:rounded-[14px]">
            {ticker.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 gap-0.5">
          <h1 data-page-title className="font-heading text-large-title md:text-title-1">
            {ticker}
          </h1>
          {name && name !== ticker ? (
            <p className="truncate text-subheadline text-muted-foreground">{name}</p>
          ) : null}
          {kind ? <p className="text-footnote text-muted-foreground">{kind}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2 max-md:hidden">{actions}</div> : null}
    </div>
  );
}
