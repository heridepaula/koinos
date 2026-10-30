import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { formatBRL, formatSignedPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Sensitive } from "./sensitive";

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
      <span
        className={cn(
          "inline-flex flex-col items-end whitespace-nowrap tabular-nums",
          tone,
          className,
        )}
      >
        <span className="inline-flex items-center gap-1">
          <Icon className="size-[1em] shrink-0" aria-hidden="true" />
          <Sensitive>{money}</Sensitive>
        </span>
        <span className="text-xs opacity-80">{percent}</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap tabular-nums",
        tone,
        className,
      )}
    >
      <Icon className="size-[1em] shrink-0" aria-hidden="true" />
      {money ? <Sensitive>{money}</Sensitive> : null}
      {money && percent ? <span className="opacity-80">({percent})</span> : percent}
    </span>
  );
}

/**
 * Variação em cápsula tingida (verde, vermelha ou neutra), como os selos do app Bolsa: seta, valor
 * e/ou %, e um sufixo opcional ("hoje"). O texto fica na cor de ganho ou perda, com 4,5:1.
 */
export function DeltaChip({
  value,
  pct,
  suffix,
  showIcon = true,
  className,
}: {
  value?: number | null;
  pct?: number | null;
  suffix?: string;
  /** Sem a seta quando o valor ao lado já tem a sua (a cor e o sinal continuam). */
  showIcon?: boolean;
  className?: string;
}) {
  const amount =
    value === undefined || value === null ? null : Math.abs(value) < ZERO_BELOW ? 0 : value;
  const reference = amount ?? pct ?? 0;
  const Icon = reference > 0 ? ArrowUpRightIcon : reference < 0 ? ArrowDownRightIcon : MinusIcon;
  const money = amount === null ? null : `${amount > 0 ? "+" : ""}${formatBRL(amount)}`;
  const percent = pct === undefined || pct === null ? null : formatSignedPercent(pct);
  return (
    <span
      className={cn(
        "inline-flex h-7 w-fit items-center gap-1 rounded-full px-3 text-footnote font-semibold whitespace-nowrap tabular-nums",
        // Tinta leve (6% no claro, 8% no escuro): com 10%, o texto caía para 4,2:1 no claro.
        reference > 0
          ? "bg-gain/6 text-gain dark:bg-gain/8"
          : reference < 0
            ? "bg-loss/6 text-loss dark:bg-loss/8"
            : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {showIcon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
      {money ? <Sensitive>{money}</Sensitive> : null}
      {money && percent ? " · " : null}
      {percent}
      {suffix ? <span className="font-normal">{suffix}</span> : null}
    </span>
  );
}
