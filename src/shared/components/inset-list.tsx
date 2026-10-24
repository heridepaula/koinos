import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/*
 * Lista agrupada do iOS (inset grouped), para folhas e telas do celular: um título de seção pequeno
 * e as células num bloco arredondado, com fios de cabelo entre elas. As células têm 52 px de altura
 * mínima (alvo de toque folgado) e afundam no toque.
 */

export function InsetGroup({
  title,
  className,
  children,
}: {
  title?: string;
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
    </section>
  );
}

/** Classes da célula: use em links, botões ou blocos estáticos (sem o estado de toque). */
export const insetRowClass = (interactive = true) =>
  cn(
    "flex min-h-13 w-full items-center gap-3 px-4 py-2 text-left text-[1.0625rem] leading-[1.375rem] outline-none",
    interactive &&
      "transition-colors duration-150 select-none [-webkit-touch-callout:none] focus-visible:bg-foreground/5 active:bg-foreground/8",
  );
