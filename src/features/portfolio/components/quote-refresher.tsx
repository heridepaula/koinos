"use client";

import { RefreshCwIcon } from "lucide-react";
import { formatDateTime } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { requestManualQuoteRefresh, useQuoteRefreshPending } from "./quote-refresh-store";

/**
 * Mostra o horário das cotações e o botão manual. Quem atualiza sozinho é o `QuoteClock`, no
 * layout: aqui só aparece o estado (em andamento, em dia) e o pedido manual.
 */
export function QuoteRefresher({
  staleCount,
  lastFetchedAt,
  marketOpen,
}: {
  staleCount: number;
  lastFetchedAt: Date | null;
  /** O pregão agora: o texto começa por "Mercado aberto" ou "Mercado fechado". */
  marketOpen: boolean;
}) {
  const isPending = useQuoteRefreshPending();

  const fresh = !isPending && staleCount === 0 && lastFetchedAt !== null;
  // Selo de status em vidro: ponto verde com as cotações em dia, âmbar pulsando enquanto atualiza.
  // A cápsula tem 40 px e o botão 32 (52 e 44 no toque), concêntricos: 4 px de anel. No iPhone,
  // sem a cápsula: uma linha de status sob o título grande, como o "Atualizado agora" do Mail.
  return (
    <div className="flex items-center gap-2 text-footnote text-muted-foreground max-md:-my-2.5 md:h-10 md:rounded-full md:glass md:py-1 md:pr-1 md:pl-3">
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          fresh ? "bg-gain" : "bg-warn",
          isPending && "motion-safe:animate-pulse",
        )}
      />
      <span className="tabular-nums" aria-live="polite">
        <span className="font-medium text-foreground">
          {marketOpen ? "Mercado aberto" : "Mercado fechado"}
        </span>
        {" · "}
        {isPending
          ? "Atualizando cotações…"
          : lastFetchedAt
            ? `Cotações de ${formatDateTime(lastFetchedAt)}`
            : "Sem cotações ainda"}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Atualizar cotações"
        disabled={isPending}
        onClick={requestManualQuoteRefresh}
      >
        <RefreshCwIcon className={isPending ? "motion-safe:animate-spin" : undefined} />
      </Button>
    </div>
  );
}
