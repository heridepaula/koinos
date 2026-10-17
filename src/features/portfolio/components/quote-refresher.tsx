"use client";

import { useMutation } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/shared/lib/format";
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

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span>
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
        <RefreshCwIcon className={isPending ? "animate-spin" : undefined} />
      </Button>
    </div>
  );
}
