"use client";

import { InfoIcon } from "lucide-react";
import { Delta } from "@/shared/components/delta";
import { formatBRL } from "@/shared/lib/format";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/shared/ui/popover";

/**
 * "Resultado total" com a conta à mostra (ao passar o mouse ou tocar): o L/P da cotação das
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
        className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Resultado total <Delta value={total} />
        <InfoIcon className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <PopoverTitle className="text-sm font-medium">O que é o resultado total</PopoverTitle>
        <p className="text-xs text-muted-foreground">
          Tudo o que a carteira já rendeu: a variação da cotação do que você tem hoje, os proventos
          que caíram na conta e o lucro (ou prejuízo) das vendas.
        </p>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-sm tabular-nums">
          <dt>Cotação (posições abertas)</dt>
          <dd className="text-right">{formatBRL(pnl)}</dd>
          <dt>+ Proventos recebidos</dt>
          <dd className="text-right">{formatBRL(dividends)}</dd>
          <dt>= L/P com proventos</dt>
          <dd className="text-right">{formatBRL(withDividends)}</dd>
          <dt>+ Vendas (realizado)</dt>
          <dd className="text-right">{formatBRL(realized)}</dd>
          <dt className="font-medium">= Resultado total</dt>
          <dd className="text-right font-medium">{formatBRL(total)}</dd>
        </dl>
      </PopoverContent>
    </Popover>
  );
}
