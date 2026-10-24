"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type ComponentProps,
} from "react";
import {
  maskMoneyInput,
  moneyToInput,
  parseMoneyInput,
  parseNumberInput,
} from "@/shared/lib/parse-number";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";

type MoneyInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "defaultValue" | "onChange" | "type" | "inputMode" | "ref" | "size"
> & {
  defaultValue?: number | null;
  /** "lg": entrada de valor em destaque, como a do Apple Pay (56 px, algarismos em Title 2). */
  size?: "default" | "lg";
  /** Valor em reais a cada tecla (0 com o campo em "0,00"). */
  onValueChange: (value: number | null) => void;
};

/** Valor colado em reais ("2.500,75", "2500.75" ou "2500"): vira o texto da máscara. */
function pastedToMask(text: string): string | null {
  const value = parseNumberInput(text.replace(/[^\d.,]/g, ""));
  return Number.isFinite(value) ? moneyToInput(value) : null;
}

/**
 * Campo em reais com o "R$" na frente e a máscara que enche a partir dos centavos: começa em
 * "0,00", e digitar 1, 2, 0, 0, 0, 0 e 0 mostra 0,01, 0,12, 1,20… até 12.000,00.
 * - Só os dígitos contam, e entram sempre no fim; apagar tira o último.
 * - O cursor fica no fim, onde o próximo dígito entra.
 * - Um valor colado é lido em reais ("2500" é R$ 2.500,00; "2500.75", com o ponto decimal).
 */
export function MoneyInput({
  defaultValue,
  size = "default",
  onValueChange,
  className,
  onFocus,
  ...props
}: MoneyInputProps) {
  const [text, setText] = useState(() => moneyToInput(defaultValue ?? 0));
  const inputRef = useRef<HTMLInputElement>(null);

  const moveCaretToEnd = () =>
    requestAnimationFrame(() => {
      const length = inputRef.current?.value.length ?? 0;
      inputRef.current?.setSelectionRange(length, length);
    });

  function show(masked: string) {
    setText(masked);
    onValueChange(parseMoneyInput(masked));
    moveCaretToEnd();
  }

  // Os dígitos novos entram sempre no fim, onde quer que o cursor esteja; apagar tira o último.
  // Com o texto todo selecionado, a tecla começa um valor novo.
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { inputType, data } = event.nativeEvent as InputEvent;
    const raw = event.target.value;
    const digits = text.replace(/\D/g, "").replace(/^0+/, "");
    let next = raw.replace(/\D/g, "");
    if (inputType === "insertText" && data !== null) {
      next = raw === data ? data : digits + data;
    } else if (inputType?.startsWith("delete")) {
      next = next === "" ? "" : digits.slice(0, -1);
    }
    show(maskMoneyInput(next));
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const masked = pastedToMask(event.clipboardData.getData("text"));
    if (masked !== null) show(masked);
  }

  return (
    <div className="relative">
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
          size === "lg" ? "left-5 text-headline font-normal" : "left-3 text-sm",
        )}
      >
        R$
      </span>
      <Input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn(
          "pl-9 tabular-nums",
          size === "lg" &&
            "h-14 rounded-2xl pr-5 pl-13 text-title-2 md:text-title-2 pointer-coarse:h-14",
          className,
        )}
        value={text}
        onChange={handleChange}
        onPaste={handlePaste}
        onFocus={(event) => {
          moveCaretToEnd();
          onFocus?.(event);
        }}
      />
    </div>
  );
}
