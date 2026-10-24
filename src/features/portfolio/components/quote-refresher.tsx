"use client";

import { useMutation } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { refreshMyQuotesAction } from "../actions";

/** Mostra o horário das cotações e, se houver alguma vencida, atualiza em segundo plano. */
export function QuoteRefresher({
  staleCount,
  lastFetchedAt,
}: {
  staleCount: number;
  lastFetchedAt: Date | null;
}) {
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const result = await refreshMyQuotesAction();
      if (result?.serverError) throw new Error(result.serverError);
      return result?.data;
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (staleCount > 0) mutate();
  }, [staleCount, mutate]);

  const fresh = !isPending && staleCount === 0 && lastFetchedAt !== null;
  // Selo de status em vidro: ponto verde com as cotações em dia, âmbar pulsando enquanto atualiza.
  // A cápsula tem 40 px e o botão 32 (52 e 44 no toque), concêntricos: 4 px de anel.
  return (
    <div className="flex h-10 items-center gap-2 rounded-full glass py-1 pr-1 pl-3 text-footnote text-muted-foreground">
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          fresh ? "bg-gain" : "bg-warn",
          isPending && "motion-safe:animate-pulse",
        )}
      />
      <span className="tabular-nums" aria-live="polite">
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
        onClick={() => mutate()}
      >
        <RefreshCwIcon className={isPending ? "motion-safe:animate-spin" : undefined} />
      </Button>
    </div>
  );
}
