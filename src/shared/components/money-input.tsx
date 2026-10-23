"use client";

import { useRef, useState, type ChangeEvent, type ComponentProps } from "react";
import { maskMoneyInput, moneyToInput, parseMoneyInput } from "@/shared/lib/parse-number";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";

type MoneyInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "defaultValue" | "onChange" | "type" | "inputMode" | "ref"
> & {
  defaultValue?: number | null;
  /** Valor em reais a cada tecla; null com o campo vazio. */
  onValueChange: (value: number | null) => void;
};

/** Quantos dígitos e vírgulas há antes de `end`: é o que a máscara preserva. */
const significantBefore = (text: string, end: number) =>
  text.slice(0, end).replace(/[^\d,]/g, "").length;

/**
 * Campo em reais com máscara enquanto se digita ("14.000,50"), com o "R$" na frente.
 * - O ponto digitado (teclado numérico em inglês) vale como vírgula decimal, e um valor colado
 *   como "2500.75" também é lido com o ponto decimal.
 * - O cursor fica depois do mesmo dígito em que estava, mesmo quando a máscara põe ou tira pontos.
 * - Ao sair do campo, o valor ganha os centavos ("14.000" vira "14.000,00").
 */
export function MoneyInput({
  defaultValue,
  onValueChange,
  className,
  onBlur,
  ...props
}: MoneyInputProps) {
  const [text, setText] = useState(() => moneyToInput(defaultValue));
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const { inputType, data } = event.nativeEvent as InputEvent;
    let raw = input.value;
    const caret = input.selectionStart ?? raw.length;
    if (inputType === "insertText" && data === "." && !raw.includes(",")) {
      raw = `${raw.slice(0, caret - 1)},${raw.slice(caret)}`;
    } else if (inputType === "insertFromPaste" && !raw.includes(",")) {
      raw = raw.replace(/\.(\d{1,2})$/, ",$1");
    }
    const keep = significantBefore(raw, caret);
    const masked = maskMoneyInput(raw);
    setText(masked);
    onValueChange(parseMoneyInput(masked));
    // Depois que o React grava o texto novo, o cursor volta para depois do mesmo dígito.
    requestAnimationFrame(() => {
      let position = 0;
      for (let seen = 0; position < masked.length && seen < keep; position++) {
        if (/[\d,]/.test(masked[position])) seen++;
      }
      inputRef.current?.setSelectionRange(position, position);
    });
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn("pl-9 tabular-nums", className)}
        value={text}
        onChange={handleChange}
        onBlur={(event) => {
          const value = parseMoneyInput(text);
          if (value !== null) setText(moneyToInput(value));
          onBlur?.(event);
        }}
      />
    </div>
  );
}
