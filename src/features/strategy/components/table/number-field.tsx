"use client";

import { useState } from "react";
import { toast } from "sonner";
import { numberToInput, parseNumberInput } from "@/shared/lib/parse-number";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";

/**
 * Campo numérico que salva ao sair (ou com Enter); vazio é "sem valor". Na tabela, fica como texto
 * sobre um preenchimento leve e só mostra a borda ao passar o mouse ou focar, como as células
 * editáveis do Numbers: são dezenas de campos, e todos com borda viravam ruído.
 */
export function NumberField({
  value,
  label,
  integer,
  className,
  onCommit,
}: {
  value: number | null;
  label: string;
  integer?: boolean;
  className?: string;
  onCommit: (value: number | null) => void;
}) {
  const [text, setText] = useState(numberToInput(value));
  const [lastValue, setLastValue] = useState(value);
  // Valor novo vindo do servidor (após salvar): reflete no campo.
  if (value !== lastValue) {
    setLastValue(value);
    setText(numberToInput(value));
  }

  function commit() {
    const parsed = text.trim() === "" ? null : parseNumberInput(text);
    if (parsed !== null && (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed)))) {
      toast.error(`${label}: valor inválido.`);
      setText(numberToInput(value));
      return;
    }
    if (parsed !== value) onCommit(parsed);
  }

  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      className={cn(
        "w-24 border-transparent bg-secondary/60 text-right tabular-nums hover:border-input dark:bg-secondary/60",
        className,
      )}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}
