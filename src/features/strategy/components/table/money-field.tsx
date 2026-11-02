"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/shared/components/money-input";
import { cn } from "@/shared/lib/utils";
import { ceilingFromInput } from "../../domain/ceiling";

/**
 * Campo de teto em reais, com a máscara de moeda do app (o "R$" na frente, os dígitos enchendo a
 * partir dos centavos: digitar 12450 mostra R$ 124,50). Como o `NumberField`, salva ao sair do
 * campo (ou com Enter) e tem o mesmo visual de célula editável. Em branco ou em 0,00 é "sem teto"
 * (null); acima do máximo, o campo volta ao valor salvo com a mensagem.
 */
export function MoneyField({
  value,
  label,
  className,
  onCommit,
}: {
  value: number | null;
  label: string;
  className?: string;
  onCommit: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState<number | null>(value);
  const [lastValue, setLastValue] = useState(value);
  // Trocar a chave recria o campo e o devolve ao valor salvo (quando o digitado é recusado).
  const [resetKey, setResetKey] = useState(0);
  // Valor novo vindo do servidor (após salvar): reflete no campo.
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  function commit() {
    const { value: next, problem } = ceilingFromInput(draft);
    if (problem) {
      toast.error(`${label}: ${problem}`);
      setDraft(value);
      setResetKey((key) => key + 1);
      return;
    }
    if (next === value) return;
    onCommit(next);
  }

  return (
    <MoneyInput
      key={resetKey}
      aria-label={label}
      allowEmpty
      placeholder="0,00"
      defaultValue={value}
      onValueChange={setDraft}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className={cn(
        "border-transparent bg-secondary/60 text-right hover:border-input dark:bg-secondary/60",
        className,
      )}
    />
  );
}
