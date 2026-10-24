import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/*
 * Lista agrupada do iOS (inset grouped), para folhas e telas do celular: um título de seção pequeno
 * e as células num bloco arredondado, com fios de cabelo entre elas. As células tocáveis têm 52 px
 * de altura mínima e afundam no toque; as de valor (rótulo e número), 44 px.
 */

export function InsetGroup({
  title,
  footer,
  className,
  children,
}: {
  title?: string;
  /** Nota em texto secundário embaixo do bloco, como o rodapé das seções dos Ajustes. */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("grid gap-1.5", className)}>
      {title ? (
        <h3 className="px-4 text-footnote font-medium text-muted-foreground">{title}</h3>
      ) : null}
      <div className="grid divide-y divide-border overflow-hidden rounded-2xl bg-card/80 dark:bg-white/6">
        {children}
      </div>
      {footer ? <p className="px-4 text-footnote text-muted-foreground">{footer}</p> : null}
    </section>
  );
}

/** Classes da célula: use em links, botões ou blocos estáticos (sem o estado de toque). */
export const insetRowClass = (interactive = true) =>
  cn(
    "flex w-full items-center gap-3 px-4 py-2 text-left text-[1.0625rem] leading-[1.375rem] outline-none",
    interactive
      ? "min-h-13 transition-colors duration-150 select-none [-webkit-touch-callout:none] focus-visible:bg-foreground/5 active:bg-foreground/8"
      : "min-h-11",
  );

/** Célula "rótulo ······ valor", como as de informação do iOS: o valor à direita, em tom secundário. */
export function InsetValueRow({
  label,
  value,
  strong,
}: {
  label: ReactNode;
  value: ReactNode;
  /** O total de uma conta: rótulo e valor em negrito, com o valor na cor do texto. */
  strong?: boolean;
}) {
  return (
    <div className={cn(insetRowClass(false), strong && "font-semibold")}>
      <span className="flex-1">{label}</span>
      <span className={cn("text-right tabular-nums", !strong && "text-muted-foreground")}>
        {value}
      </span>
    </div>
  );
}
