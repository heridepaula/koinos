import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { formatBRL, formatSignedPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

/**
 * Valor com sinal: verde/vermelho + seta + sinal, para nunca depender só da cor.
 * `value` em R$ e/ou `pct` como fração.
 */
export function Delta({
  value,
  pct,
  className,
}: {
  value?: number | null;
  pct?: number | null;
  className?: string;
}) {
  const reference = value ?? pct ?? 0;
  const tone = reference > 0 ? "text-gain" : reference < 0 ? "text-loss" : "text-muted-foreground";
  const Icon = reference > 0 ? ArrowUpRightIcon : reference < 0 ? ArrowDownRightIcon : MinusIcon;
  const money =
    value === undefined || value === null ? null : `${value > 0 ? "+" : ""}${formatBRL(value)}`;
  const percent = pct === undefined || pct === null ? null : formatSignedPercent(pct);
  return (
    <span className={cn("inline-flex items-center gap-0.5 tabular-nums", tone, className)}>
      <Icon className="size-[1em] shrink-0" aria-hidden="true" />
      {money}
      {money && percent ? <span className="opacity-80">({percent})</span> : percent}
    </span>
  );
}
