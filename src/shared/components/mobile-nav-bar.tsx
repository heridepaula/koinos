"use client";

import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { parentOf } from "./nav-items";
import { usePageTitleUnderBar } from "./toolbar-title";

/**
 * Barra de navegação do iPhone (abaixo de 768 px), como a do iOS 26: no repouso é transparente e
 * o título grande da página fica no conteúdo; ao rolar, o conteúdo passa sob um desfoque que se
 * dissolve (o "scroll edge effect", sem fio duro) e o título compacto aparece no centro. Nas
 * subpáginas, um círculo de vidro volta para a página-mãe. Desconta a área segura de cima.
 */
export function MobileNavBar() {
  const pathname = usePathname();
  const parent = parentOf(pathname);
  const bar = useRef<HTMLElement>(null);
  const { text, underBar } = usePageTitleUnderBar(bar);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 2);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      ref={bar}
      data-scrolled={scrolled || undefined}
      className="group/nav sticky top-0 z-20 grid h-(--nav-bar-height) grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 pt-(--safe-top) pr-[max(1rem,var(--safe-right))] pl-[max(1rem,var(--safe-left))] md:hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -bottom-6 -z-10 bg-linear-to-b from-background/90 via-background/70 to-background/0 [mask-image:linear-gradient(to_bottom,#000_65%,transparent)] opacity-0 backdrop-blur-xl transition-opacity duration-300 group-data-scrolled/nav:opacity-100 motion-reduce:transition-none"
      />
      <div className="justify-self-start">
        {parent ? (
          <Link
            href={parent.href}
            aria-label={`Voltar para ${parent.label}`}
            className="grid size-11 press-spring place-items-center rounded-full glass-strong select-none [-webkit-touch-callout:none]"
          >
            <ChevronLeftIcon className="size-6 -translate-x-px" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <p
        aria-hidden={!underBar}
        className={cn(
          "max-w-[60vw] truncate text-headline transition-[opacity,translate] duration-300 ease-snappy motion-reduce:transition-none",
          underBar ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
        )}
      >
        {text}
      </p>
    </header>
  );
}
