"use client";

import { useAction } from "next-safe-action/hooks";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Sensitive } from "@/shared/components/sensitive";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { setAssetCnpjAction } from "../actions";
import { formatCnpj, isValidCnpj, maskCnpj } from "../domain/cnpj";
import type { CnpjSource } from "../domain/types";

const SOURCE_LABEL: Record<CnpjSource, string> = {
  CVM_FCA: "CVM",
  CVM_ISIN: "CVM",
  CVM_ISIN_NOME: "CVM (por nome)",
  MANUAL: "Informado por você",
};

/**
 * O CNPJ do emissor de um ativo. Sem CNPJ, é o campo para digitar (máscara e dígitos conferidos
 * antes de enviar). Com CNPJ, mostra o número e a origem ("CVM" ou "Informado por você"), e
 * "Corrigir" abre o mesmo campo. O CNPJ digitado vale sobre o da CVM.
 */
export function CnpjField({
  ticker,
  cnpj,
  source,
}: {
  ticker: string;
  cnpj: string | null;
  source: CnpjSource | null;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const inputId = useId();
  const { execute, isPending } = useAction(setAssetCnpjAction, {
    onSuccess: () => {
      toast.success(`CNPJ de ${ticker} salvo.`);
      setEditing(false);
      setText("");
    },
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });

  const showForm = editing || !cnpj;
  const complete = text.replace(/\D/g, "").length === 14;
  const invalid = complete && !isValidCnpj(text);

  if (!showForm) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="tabular-nums">
          <Sensitive mask="••.•••.•••/••••-••">{formatCnpj(cnpj)}</Sensitive>
        </span>
        {source ? (
          <span className="text-footnote text-muted-foreground">{SOURCE_LABEL[source]}</span>
        ) : null}
        <Button type="button" variant="outline" size="xs" onClick={() => setEditing(true)}>
          Corrigir
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (complete && !invalid) execute({ ticker, cnpj: text });
      }}
    >
      <label htmlFor={inputId} className="text-footnote text-muted-foreground">
        {cnpj ? "Novo CNPJ do emissor" : "Digite os 14 números do CNPJ"}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={inputId}
          inputMode="numeric"
          autoComplete="off"
          placeholder="00.000.000/0000-00"
          value={text}
          onChange={(event) => setText(maskCnpj(event.target.value))}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${inputId}-erro` : undefined}
          className="w-52 tabular-nums"
        />
        <Button type="submit" size="sm" disabled={!complete || invalid || isPending}>
          Salvar
        </Button>
        {cnpj ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(false);
              setText("");
            }}
          >
            Cancelar
          </Button>
        ) : null}
      </div>
      {invalid ? (
        <p id={`${inputId}-erro`} className="text-footnote text-loss">
          CNPJ inválido: confira os dígitos.
        </p>
      ) : null}
    </form>
  );
}
