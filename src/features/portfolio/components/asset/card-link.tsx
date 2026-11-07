import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Atalho no pé de um card, como as células que navegam no iOS: o texto na cor do texto (o azul do
 * link fica abaixo de 4,5:1 sobre o card) e o chevron em cinza, numa linha de 44 px.
 */
export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="-mx-2 mt-3 flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 text-sm font-medium transition-colors duration-150 outline-none hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-foreground/8"
    >
      {children}
      <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
