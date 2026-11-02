"use client";

import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Slider } from "@/shared/ui/slider";

/** Atalhos de divisão: a % dos FIIs. */
const PRESETS = [30, 50, 70] as const;

/** Um dos dois lados: o nome com a bolinha da cor, a % grande e o valor em reais. */
function Side({
  label,
  percent,
  amount,
  dot,
  align,
}: {
  label: string;
  percent: number;
  amount: number | null;
  dot: string;
  align: "left" | "right";
}) {
  return (
    <div className={cn("grid gap-0.5", align === "right" && "justify-items-end text-right")}>
      <span className="flex items-center gap-1.5 text-footnote text-muted-foreground">
        <span className={cn("size-2 rounded-full", dot)} aria-hidden="true" />
        {label}
      </span>
      <span className="text-title-2 tabular-nums">{percent}%</span>
      <span className="min-h-5 text-footnote text-muted-foreground tabular-nums">
        {amount !== null ? <Sensitive>{formatBRL(amount)}</Sensitive> : "—"}
      </span>
    </div>
  );
}

/** Atalho em cápsula, como as do iOS: o selecionado ganha o fundo de destaque. */
function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "relative rounded-full px-3 py-1 text-footnote font-medium tabular-nums transition-colors outline-none after:absolute after:-inset-1.5 after:content-[''] focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:py-1.5",
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
      )}
    >
      {children}
    </button>
  );
}

/**
 * A divisão do aporte entre FIIs e ações (visão Geral), no jeito de um ajuste do iPhone: as duas
 * partes lado a lado em tipo grande, um controle deslizante de duas cores (azul os FIIs, laranja as
 * ações) com um polegar branco grande, uma marca de onde a carteira está hoje e atalhos em cápsula.
 */
export function SplitControl({
  fiis,
  onChange,
  step,
  fiiAmount,
  stockAmount,
  todayFiis,
}: {
  /** A % do aporte para os FIIs (0 a 100). */
  fiis: number;
  onChange: (value: number) => void;
  step: number;
  /** As partes em reais; null enquanto não há valor digitado. */
  fiiAmount: number | null;
  stockAmount: number | null;
  /** A fatia dos FIIs hoje no patrimônio, de 0 a 1. */
  todayFiis: number;
}) {
  // A marca de hoje cai no passo mais perto, que é onde o polegar pode parar.
  const todayPercent = Math.round((todayFiis * 100) / step) * step;
  const hasToday = todayFiis > 0 && todayFiis < 1;
  return (
    <div className="grid gap-4 rounded-2xl bg-muted/50 p-4">
      <div className="grid grid-cols-2 gap-4">
        <Side label="FIIs" percent={fiis} amount={fiiAmount} dot="bg-chart-1" align="left" />
        <Side
          label="Ações"
          percent={100 - fiis}
          amount={stockAmount}
          dot="bg-chart-2"
          align="right"
        />
      </div>
      <div className="grid gap-1">
        <Slider
          label="Parte do aporte para FIIs"
          value={fiis}
          step={step}
          onValueChange={onChange}
          valueText={(current) => `${current}% para FIIs, ${100 - current}% para ações`}
          trackClassName="h-2.5 bg-chart-2/80"
          indicatorClassName="bg-chart-1"
          thumbClassName="size-7 pointer-coarse:size-8 shadow-[0_2px_6px_rgb(0_0_0/0.28),0_0_0_0.5px_rgb(0_0_0/0.1)]"
        />
        {hasToday ? (
          <div className="relative h-5" aria-hidden="true">
            <span
              className="absolute top-0 grid -translate-x-1/2 justify-items-center gap-0.5"
              style={{ left: `${todayPercent}%` }}
            >
              <span className="h-1.5 w-0.5 rounded-full bg-muted-foreground/60" />
              <span className="text-caption text-muted-foreground">hoje</span>
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((value) => (
          <Chip key={value} selected={fiis === value} onClick={() => onChange(value)}>
            {value}/{100 - value}
          </Chip>
        ))}
        {hasToday ? (
          <Chip selected={fiis === todayPercent} onClick={() => onChange(todayPercent)}>
            Como hoje
          </Chip>
        ) : null}
      </div>
    </div>
  );
}
