"use client";

import { useAction } from "next-safe-action/hooks";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/shared/components/money-input";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { Button } from "@/shared/ui/button";
import { saveOpeningLossAction } from "../actions";
import type { FiscalClass } from "../domain/types";

/**
 * O saldo de prejuízo a compensar que o dono tinha antes do primeiro mês do livro-razão (nov/2019),
 * por classe. A apuração soma os prejuízos dali em diante; sem este número, ela começa em zero e
 * o relatório avisa.
 */
export function OpeningLossForm({ initial }: { initial: Record<FiscalClass, number> }) {
  const [values, setValues] = useState<Record<FiscalClass, number>>(initial);
  const fiiId = useId();
  const acaoId = useId();
  const { execute, isPending } = useAction(saveOpeningLossAction, {
    onSuccess: () => toast.success("Saldo de prejuízo salvo."),
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        execute({ fii: values.FII, acao: values.ACAO });
      }}
    >
      <fieldset className="grid gap-3">
        <legend className="text-subheadline font-medium">
          Saldo de prejuízo a compensar anterior a nov/2019 (início do histórico no Koinos)
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor={fiiId} className="text-footnote text-muted-foreground">
              FIIs
            </label>
            <MoneyInput
              id={fiiId}
              defaultValue={initial.FII}
              onValueChange={(value) => setValues((v) => ({ ...v, FII: value ?? 0 }))}
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={acaoId} className="text-footnote text-muted-foreground">
              Ações
            </label>
            <MoneyInput
              id={acaoId}
              defaultValue={initial.ACAO}
              onValueChange={(value) => setValues((v) => ({ ...v, ACAO: value ?? 0 }))}
            />
          </div>
        </div>
      </fieldset>
      <div>
        <Button type="submit" disabled={isPending}>
          Salvar saldo
        </Button>
      </div>
    </form>
  );
}
