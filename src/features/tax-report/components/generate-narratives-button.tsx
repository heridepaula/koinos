"use client";

import { SparklesIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { Button } from "@/shared/ui/button";
import { generateTaxNarrativesAction } from "../actions";
import type { TaxNarrativesView } from "../domain/types";

/**
 * "Gerar textos com IA": pede ao servidor a reescrita da discriminação e as explicações dos
 * achados (Gemini). Só o dono clica: manda ao Gemini o ticker, a classe, a quantidade, o custo, o
 * CNPJ e a razão social das posições, e só o tipo dos achados. A página nunca gera sozinha.
 */
export function GenerateNarrativesButton({
  year,
  narratives,
}: {
  year: number;
  narratives: TaxNarrativesView;
}) {
  const { execute, isPending } = useAction(generateTaxNarrativesAction, {
    onSuccess: ({ data }) => {
      if (data?.status === "generated") toast.success("Textos gerados.");
      else if (data?.status === "unchanged") toast.info("Os textos já estão atualizados.");
      else toast.error("Não foi possível gerar os textos agora. Os textos fixos seguem valendo.");
    },
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  const hasTexts =
    Object.keys(narratives.positions).length + Object.keys(narratives.codes).length > 0;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => execute({ year })}
      data-print-hide
    >
      <SparklesIcon aria-hidden="true" data-icon="inline-start" />
      {isPending
        ? "Gerando…"
        : narratives.stale
          ? "Atualizar textos com IA"
          : hasTexts
            ? "Gerar textos de novo"
            : "Gerar textos com IA"}
    </Button>
  );
}
