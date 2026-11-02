"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { removeTargetAssetAction, updateTargetAssetAction } from "../../actions";
import type { Bias } from "../../domain/bias";
import type { Category } from "../../domain/categories";

export type TargetPatch = {
  inStrategy?: boolean;
  rank?: number | null;
  ceilingPrice?: number | null;
  suggestedPercent?: number | null;
  category?: Category | null;
  bias?: Bias | null;
};

/**
 * Salvar um campo e remover o ativo: as mesmas ações na linha da tabela e na folha do celular.
 * `onRemoved` fecha a folha: o ativo removido (sem posição) some da lista.
 */
export function useTargetRow(ticker: string, { onRemoved }: { onRemoved?: () => void } = {}) {
  const update = useAction(updateTargetAssetAction, {
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  const remove = useAction(removeTargetAssetAction, {
    onSuccess: () => {
      toast.success(`${ticker} removido da Carteira Alvo.`);
      onRemoved?.();
    },
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  return {
    save: (patch: TargetPatch) => update.execute({ ticker, ...patch }),
    remove: () => remove.execute({ ticker }),
    removing: remove.isPending,
  };
}
