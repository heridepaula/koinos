import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Recolhível nativo (details/summary) com o chevron que gira na mola snappy: para o que está em
 * ordem e só interessa a quem quer conferir. O resumo tem 44 px de altura no toque.
 */
export function Disclosure({
  summary,
  summaryClassName,
  className,
  children,
}: {
  summary: ReactNode;
  summaryClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={cn("group", className)}>
      <summary
        className={cn(
          "flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm text-sm font-medium outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden",
          summaryClassName,
        )}
      >
        {summary}
        <ChevronDownIcon
          className="size-4 transition-transform duration-420 ease-snappy group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
