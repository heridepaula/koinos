import { ChevronsUpDownIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Select nativo com a cara do botão pop-up do macOS: a altura e o raio do Input (36 px, 44 no
 * toque), sem a seta do sistema e com o chevron duplo à direita. A lista aberta continua sendo a
 * do sistema, que no celular é a melhor. A largura vai no `wrapperClassName`. No celular a fonte
 * tem 16 px, como a do Input: com menos, o Safari do iPhone amplia a página ao abrir a lista.
 */
function NativeSelect({
  className,
  wrapperClassName,
  ...props
}: React.ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <span data-slot="native-select" className={cn("relative inline-flex", wrapperClassName)}>
      <select
        className={cn(
          "h-9 w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-input bg-transparent py-1 pr-9 pl-3 text-base text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 pointer-coarse:h-11",
          className,
        )}
        {...props}
      />
      <ChevronsUpDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  );
}

export { NativeSelect };
