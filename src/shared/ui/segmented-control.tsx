"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: ReactNode };

/**
 * Controle segmentado da Apple: trilho em cápsula e um marcador claro que desliza até a opção
 * escolhida, com a mola bouncy (sem animação com movimento reduzido). Segmentos de mesma largura.
 * Para leitor de tela e teclado é um grupo de rádios: as setas trocam a opção, como no macOS.
 * Altura de 36 px (44 no toque); `size="sm"` tem 32. No toque, a área de cada segmento cobre também
 * o respiro de 2 px do trilho: o alvo tem os 44 px inteiros.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "default",
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  /** Nome do grupo para leitor de tela. */
  label: string;
  size?: "default" | "sm";
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "relative isolate grid w-fit auto-cols-fr grid-flow-col rounded-full bg-secondary p-0.5",
        size === "sm" ? "h-8 pointer-coarse:h-11" : "h-9 pointer-coarse:h-11",
        className,
      )}
    >
      {/* O marcador: um segmento de largura, deslocado pelo índice da opção escolhida. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 -z-10 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.12),0_2px_6px_rgb(0_0_0/0.08),inset_0_0_0_0.5px_rgb(0_0_0/0.04)] transition-transform duration-690 ease-bouncy motion-reduce:transition-none dark:bg-[#636366] dark:shadow-[0_1px_2px_rgb(0_0_0/0.4)]"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option, position) => {
        const selected = position === index;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[position] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative rounded-full px-3 font-medium whitespace-nowrap outline-none select-none [-webkit-touch-callout:none] after:absolute after:inset-x-0 after:-inset-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50",
              size === "sm" ? "text-footnote" : "text-sm",
              // No escuro, o secundário comum dá 4,4:1 sobre o trilho; 70% do primeiro plano dá 6:1.
              selected
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground dark:text-foreground/70",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
