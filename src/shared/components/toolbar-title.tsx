"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type RefObject } from "react";
import { cn } from "@/shared/lib/utils";

/** Altura da barra do topo (cápsula de 44 px + 8 de margem + folga): abaixo dela o título sumiu. */
const TOOLBAR_OFFSET = 60;

/**
 * O título grande da página aberta (`h1[data-page-title]`) já passou por baixo da barra? O Next
 * guarda a página anterior escondida (Activity), com o título dela ainda no DOM: vale o visível.
 * `offset` é a altura da barra, em px ou pelo elemento dela.
 */
export function usePageTitleUnderBar(offset: number | RefObject<HTMLElement | null>) {
  const pathname = usePathname();
  const [state, setState] = useState({ text: "", underBar: false });

  useEffect(() => {
    const heading = [...document.querySelectorAll<HTMLElement>("h1[data-page-title]")].find(
      (element) =>
        typeof element.checkVisibility === "function"
          ? element.checkVisibility()
          : element.offsetParent !== null,
    );
    if (!heading) return;
    const top = typeof offset === "number" ? offset : (offset.current?.offsetHeight ?? 0);
    // O observador avisa logo ao começar: numa página nova, o título grande está à vista.
    const observer = new IntersectionObserver(
      ([entry]) =>
        setState((current) => ({
          text: entry.isIntersecting ? current.text : (heading.textContent ?? ""),
          underBar: !entry.isIntersecting,
        })),
      { rootMargin: `-${top}px 0px 0px 0px` },
    );
    observer.observe(heading);
    return () => observer.disconnect();
  }, [pathname, offset]);

  return state;
}

/**
 * Título compacto da barra do topo, como o da navigation bar do macOS e do iOS: aparece quando o
 * título grande da página passa por baixo da barra e some quando ele volta. A largura abre pela
 * grade (0fr → 1fr) com a mola snappy, e o texto fica enquanto ela fecha. Com movimento reduzido,
 * só troca.
 */
export function ToolbarTitle() {
  const { text, underBar: visible } = usePageTitleUnderBar(TOOLBAR_OFFSET);

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "grid transition-[grid-template-columns,opacity] duration-420 ease-snappy motion-reduce:transition-none",
        visible ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0",
      )}
    >
      {/* O respiro fica dentro do texto que abre: fechado, a cápsula abraça só o botão. */}
      <span className="min-w-0 overflow-hidden">
        <span className="block pr-3 pl-1 text-subheadline font-semibold whitespace-nowrap">
          {text}
        </span>
      </span>
    </div>
  );
}
