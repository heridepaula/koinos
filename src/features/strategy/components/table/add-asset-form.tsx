"use client";

import { PlusIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { TickerInput } from "@/features/transactions/ui";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { Button } from "@/shared/ui/button";
import { addTargetAssetAction } from "../../actions";

/** Adiciona um FII à estratégia pelo ticker (com a busca do catálogo). */
export function AddAssetForm() {
  const [ticker, setTicker] = useState("");
  const add = useAction(addTargetAssetAction, {
    onSuccess: () => {
      toast.success(`${ticker} adicionado à estratégia.`);
      setTicker("");
    },
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (ticker.trim()) add.execute({ ticker });
      }}
    >
      <div className="w-32">
        <TickerInput value={ticker} onChange={setTicker} />
      </div>
      <Button type="submit" disabled={add.isPending || !ticker.trim()}>
        <PlusIcon />
        Adicionar
      </Button>
    </form>
  );
}
