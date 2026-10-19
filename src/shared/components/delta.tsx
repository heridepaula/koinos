import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { formatBRL, formatSignedPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

/** Abaixo de meio centavo o valor aparece como R$ 0,00: vale como zero (sobra de ponto flutuante). */
const ZERO_BELOW = 0.005;

/**
 * Valor com sinal: verde/vermelho + seta + sinal, para nunca depender só da cor.
 * `value` em R$ e/ou `pct` como fração. `stacked` põe o % embaixo do valor (tabelas estreitas).
 * Um `value` menor que meio centavo, em módulo, é tratado como zero (cor neutra, sem sinal).
 */
export function Delta({
  value,
  pct,
  stacked,
  className,
}: {
  value?: number | null;
  pct?: number | null;
  stacked?: boolean;
  className?: string;
}) {
  const amount =
    value === undefined || value === null ? null : Math.abs(value) < ZERO_BELOW ? 0 : value;
  const reference = amount ?? pct ?? 0;
  const tone = reference > 0 ? "text-gain" : reference < 0 ? "text-loss" : "text-muted-foreground";
  const Icon = reference > 0 ? ArrowUpRightIcon : reference < 0 ? ArrowDownRightIcon : MinusIcon;
  const money = amount === null ? null : `${amount > 0 ? "+" : ""}${formatBRL(amount)}`;
  const percent = pct === undefined || pct === null ? null : formatSignedPercent(pct);

  if (stacked && money && percent) {
    return (
      <span className={cn("inline-flex flex-col items-end tabular-nums", tone, className)}>
        <span className="inline-flex items-center gap-0.5">
          <Icon className="size-[1em] shrink-0" aria-hidden="true" />
          {money}
        </span>
        <span className="text-xs opacity-80">{percent}</span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-0.5 tabular-nums", tone, className)}>
      <Icon className="size-[1em] shrink-0" aria-hidden="true" />
      {money}
      {money && percent ? <span className="opacity-80">({percent})</span> : percent}
    </span>
  );
}
