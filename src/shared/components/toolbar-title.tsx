"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/shared/lib/utils";

/** Altura da barra do topo (cápsula de 44 px + 8 de margem + folga): abaixo dela o título sumiu. */
const TOOLBAR_OFFSET = 60;

/**
 * Título compacto da barra do topo, como o da navigation bar do iOS: aparece quando o título
 * grande da página (`h1[data-page-title]`) passa por baixo da barra e some quando ele volta.
 * A largura abre pela grade (0fr → 1fr) com a mola snappy, e o texto fica enquanto ela fecha.
 * Com movimento reduzido, só troca.
 */
export function ToolbarTitle() {
  const pathname = usePathname();
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const heading = document.querySelector<HTMLElement>("h1[data-page-title]");
    if (!heading) return;
    // O observador avisa logo ao começar: numa página nova, o título grande está à vista.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) setText(heading.textContent ?? "");
        setVisible(!entry.isIntersecting);
      },
      { rootMargin: `-${TOOLBAR_OFFSET}px 0px 0px 0px` },
    );
    observer.observe(heading);
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "grid transition-[grid-template-columns,opacity] duration-420 ease-snappy motion-reduce:transition-none",
        visible ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0",
      )}
    >
      <span className="overflow-hidden pr-3 pl-1 text-subheadline font-semibold whitespace-nowrap">
        {text}
      </span>
    </div>
  );
}
