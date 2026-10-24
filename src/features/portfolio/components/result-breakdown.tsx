"use client";

import { InfoIcon } from "lucide-react";
import { formatBRL } from "@/shared/lib/format";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/shared/ui/popover";

/**
 * Rótulo "Resultado total ⓘ" que abre a conta (ao passar o mouse ou tocar): o L/P da cotação das
 * posições abertas, mais os proventos recebidos, mais o lucro das vendas.
 */
export function ResultBreakdown({
  pnl,
  dividends,
  withDividends,
  realized,
  total,
}: {
  pnl: number;
  dividends: number;
  withDividends: number;
  realized: number;
  total: number;
}) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        openOnHover
        delay={200}
        closeDelay={100}
        aria-label={`Ver a conta do resultado total: ${formatBRL(total)}`}
        className="relative -mx-1 inline-flex cursor-pointer items-center gap-1 rounded-sm px-1 text-left outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-3"
      >
        Resultado total
        <InfoIcon className="size-3.5" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <PopoverTitle className="text-subheadline font-semibold">
          O que é o resultado total
        </PopoverTitle>
        <p className="text-footnote text-muted-foreground">
          Tudo o que a carteira já rendeu: a variação da cotação do que você tem hoje, os proventos
          que caíram na conta e o lucro (ou prejuízo) das vendas.
        </p>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm tabular-nums">
          <dt>Cotação (posições abertas)</dt>
          <dd className="text-right">{formatBRL(pnl)}</dd>
          <dt>+ Proventos recebidos</dt>
          <dd className="text-right">{formatBRL(dividends)}</dd>
          <dt>= L/P com proventos</dt>
          <dd className="text-right">{formatBRL(withDividends)}</dd>
          <dt>+ Vendas (realizado)</dt>
          <dd className="text-right">{formatBRL(realized)}</dd>
          <dt className="border-t border-border pt-1 font-semibold">= Resultado total</dt>
          <dd className="border-t border-border pt-1 text-right font-semibold">
            {formatBRL(total)}
          </dd>
        </dl>
      </PopoverContent>
    </Popover>
  );
}
