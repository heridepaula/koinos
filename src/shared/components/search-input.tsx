import { SearchIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";

/**
 * Campo de busca como o do macOS: cápsula com a lupa à esquerda. O `type="search"` dá o botão de
 * limpar do navegador. A largura vai no `wrapperClassName`.
 */
export function SearchInput({
  className,
  wrapperClassName,
  ...props
}: React.ComponentProps<typeof Input> & { wrapperClassName?: string }) {
  return (
    <span className={cn("relative inline-flex", wrapperClassName)}>
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input type="search" className={cn("rounded-full pl-9", className)} {...props} />
    </span>
  );
}
