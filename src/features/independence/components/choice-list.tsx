"use client";

import { CheckIcon } from "lucide-react";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export type Choice<K extends string> = { key: K; label: string; detail?: ReactNode };

/**
 * Cartões de escolha única, um embaixo do outro. Para leitor de tela e teclado é um grupo de
 * rádios: as setas trocam a opção. Cada cartão tem pelo menos 44 px no toque.
 */
export function ChoiceList<K extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: K;
  onChange: (key: K) => void;
  options: readonly Choice<K>[];
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    options.findIndex((option) => option.key === value),
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next]!.key);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className="grid gap-2">
      {options.map((option, position) => {
        const selected = option.key === value;
        return (
          <button
            key={option.key}
            ref={(element) => {
              refs.current[position] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={position === index ? 0 : -1}
            onClick={() => onChange(option.key)}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-14",
              selected
                ? "border-primary bg-primary/5 dark:bg-primary/10"
                : "border-border hover:bg-muted",
            )}
          >
            <span className="grid flex-1 gap-0.5">
              <span className="text-sm font-medium">{option.label}</span>
              {option.detail ? (
                <span className="text-footnote text-muted-foreground">{option.detail}</span>
              ) : null}
            </span>
            <CheckIcon
              aria-hidden="true"
              className={cn("size-4 text-primary", selected ? "opacity-100" : "opacity-0")}
            />
          </button>
        );
      })}
    </div>
  );
}
