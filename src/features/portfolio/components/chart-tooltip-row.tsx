import type { ReactNode } from "react";

/** Linha do tooltip: indicador da série + nome + valor (o texto usa cores de texto, não a da série). */
export function ChartTooltipRow({
  color,
  label,
  value,
}: {
  color: string;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex w-full items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: color }} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}
