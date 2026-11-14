"use client";

import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { hasInAppHistory, useTrackInAppNavigation } from "@/shared/lib/in-app-navigation";
import { cn } from "@/shared/lib/utils";
import { parentOf } from "./nav-items";
import { usePageTitleUnderBar } from "./toolbar-title";

/**
 * Barra de navegação do iPhone (abaixo de 768 px), como a do iOS 26: no repouso é transparente e
 * o título grande da página fica no conteúdo; ao rolar, o conteúdo passa sob um desfoque que se
 * dissolve (o "scroll edge effect", sem fio duro) e o título compacto aparece no centro. Nas
 * subpáginas, um círculo de vidro volta: para a tela anterior, como no iOS, quando se chegou
 * navegando pelo app; senão, para a página-mãe. Desconta a área segura de cima.
 */
export function MobileNavBar({ trailing }: { trailing?: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const parent = parentOf(pathname);
  useTrackInAppNavigation(pathname);
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
      className="group/nav sticky top-0 z-20 grid h-(--nav-bar-height) grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 pt-(--safe-top) pr-[max(1rem,var(--safe-right))] pl-[max(1rem,var(--safe-left))] md:hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -bottom-6 -z-10 bg-linear-to-b from-background/90 via-background/70 to-background/0 [mask-image:linear-gradient(to_bottom,#000_65%,transparent)] opacity-0 backdrop-blur-xl transition-opacity duration-300 group-data-scrolled/nav:opacity-100 motion-reduce:transition-none"
      />
      <div className="min-w-0 justify-self-start">
        {parent ? (
          <Link
            href={parent.href}
            onClick={(event) => {
              if (!hasInAppHistory()) return;
              event.preventDefault();
              router.back();
            }}
            aria-label="Voltar"
            className="grid size-11 press-spring place-items-center rounded-full glass-strong select-none [-webkit-touch-callout:none]"
          >
            <ChevronLeftIcon className="size-6 -translate-x-px" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <p
        aria-hidden={!underBar}
        className={cn(
          "min-w-0 truncate text-center text-headline transition-[opacity,translate] duration-300 ease-snappy motion-reduce:transition-none",
          underBar ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
        )}
      >
        {text}
      </p>
      {/* À direita, as ações da barra (o olho dos valores e o sino), numa cápsula de vidro. */}
      {trailing ? (
        <div className="flex h-11 min-w-11 items-center justify-self-end rounded-full glass-strong">
          {trailing}
        </div>
      ) : null}
    </header>
  );
}
