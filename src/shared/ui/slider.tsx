"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "@/shared/lib/utils";

/**
 * Controle deslizante de um valor (Base UI): trilho em cápsula, o trecho até o polegar na cor de
 * destaque e um polegar claro, como o `SegmentedControl`. Setas mudam um passo; no toque, a área
 * do polegar tem 44 px.
 */
export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  valueText,
  className,
  trackClassName,
  indicatorClassName,
  thumbClassName,
}: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Nome do controle para leitor de tela. */
  label: string;
  /** Texto do valor para leitor de tela (ex.: "70% FIIs, 30% ações"). */
  valueText?: (value: number) => string;
  className?: string;
  /** Trilho, trecho preenchido e polegar com outro visual (ex.: duas cores, polegar maior). */
  trackClassName?: string;
  indicatorClassName?: string;
  thumbClassName?: string;
}) {
  return (
    <SliderPrimitive.Root
      value={value}
      onValueChange={(next) => onValueChange(next)}
      min={min}
      max={max}
      step={step}
      largeStep={step * 2}
      className={cn("w-full touch-none select-none", className)}
    >
      <SliderPrimitive.Control className="relative flex h-6 w-full items-center pointer-coarse:h-11">
        <SliderPrimitive.Track
          className={cn("relative h-1.5 w-full rounded-full bg-secondary", trackClassName)}
        >
          <SliderPrimitive.Indicator
            className={cn("h-full rounded-full bg-primary", indicatorClassName)}
          />
          <SliderPrimitive.Thumb
            aria-label={label}
            getAriaValueText={valueText ? (_text, current) => valueText(current) : undefined}
            className={cn(
              "size-5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3),0_0_0_0.5px_rgb(0_0_0/0.08)] transition-[scale] ease-snappy outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[dragging]:scale-110 motion-reduce:transition-none pointer-coarse:size-7",
              thumbClassName,
            )}
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}
