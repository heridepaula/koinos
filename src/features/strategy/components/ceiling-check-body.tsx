import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/shared/lib/utils";
import { ceilingCheckDetails, type CeilingCheck } from "../domain/ceiling";

/**
 * Cores do sinal: verde para o positivo e vermelho para o negativo. Sobre o card e a folha do
 * celular valem os tokens AA do projeto (`gain` e `loss`, com a tinta de 6% no claro e 8% no
 * escuro, como o `DeltaChip`). O tooltip tem o fundo invertido (escuro no tema claro, claro no
 * tema escuro), e os mesmos tons perderiam contraste lá: ele usa um par próprio por tema, com no
 * mínimo 4,5:1 sobre o selo.
 */
const TONES = {
  card: {
    positive: "bg-gain/6 text-gain dark:bg-gain/8",
    negative: "bg-loss/6 text-loss dark:bg-loss/8",
  },
  inverse: {
    positive: "bg-emerald-300/15 text-emerald-300 dark:bg-emerald-800/10 dark:text-emerald-800",
    negative: "bg-red-300/15 text-red-300 dark:bg-red-700/10 dark:text-red-700",
  },
} as const;

/**
 * O corpo do aviso de divergência do teto (spec divergencia-teto, §4): um selo colorido com o
 * sinal (Positivo: o calculado está acima do teto do ranking; Negativo: abaixo) e a diferença, a
 * manchete, os valores em colunas (e o preço atual contra o calculado, quando há), a conta e o que
 * ela quer dizer. `surface` diz onde ele está: "card" (a folha do celular, o padrão) ou "inverse"
 * (o tooltip, de fundo invertido).
 */
export function CeilingCheckBody({
  check,
  ceiling,
  price = null,
  surface = "card",
  className,
}: {
  check: CeilingCheck;
  /** O teto do ranking. */
  ceiling: number;
  /** O preço atual, para dizer se já passou do teto calculado. */
  price?: number | null;
  surface?: "card" | "inverse";
  className?: string;
}) {
  const details = ceilingCheckDetails(check, ceiling, price);
  const Arrow = details.direction === "positive" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <div className={cn("grid gap-2.5 text-left leading-snug", className)}>
      <div className="grid justify-items-start gap-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums",
            TONES[surface][details.direction],
          )}
        >
          <Arrow className="size-3" aria-hidden="true" />
          {details.badge} {details.change}
        </span>
        <p className="font-medium">{details.headline}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 tabular-nums">
        {details.rows.map((row) => (
          <Fragment key={row.label}>
            <dt className="opacity-70">{row.label}</dt>
            <dd className="text-right font-medium">
              {row.value}
              {row.note ? (
                <span
                  className={cn(
                    "block text-[0.6875rem] leading-tight font-normal opacity-80",
                    row.tone === "warn" && "font-semibold opacity-100",
                  )}
                >
                  {row.note}
                </span>
              ) : null}
            </dd>
          </Fragment>
        ))}
      </dl>
      <p className="border-t border-current/20 pt-2 text-[0.6875rem] opacity-80">
        {details.formula}
      </p>
      <p className="text-[0.6875rem] opacity-80">{details.meaning}</p>
    </div>
  );
}
