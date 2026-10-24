"use client";

import { cn } from "cn";
import { useEffect, useState, type ReactNode } from "react";

/** Abaixo disso a barra fica sempre à mostra; o passo evita piscar com o tremido do trackpad. */
const TOP_ZONE = 64;
const STEP = 8;

/**
 * Barra do topo que some ao rolar para baixo e volta ao rolar para cima (ou com o foco do
 * teclado dentro dela). Com movimento reduzido, troca sem animar.
 */
export function AutoHideHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      if (y < TOP_ZONE) setHidden(false);
      else if (y - last > STEP) setHidden(true);
      else if (last - y > STEP) setHidden(false);
      else return;
      last = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      data-hidden={hidden || undefined}
      className={cn(
        "transition-transform duration-300 ease-out motion-reduce:transition-none",
        "data-hidden:-translate-y-[calc(100%+1rem)] data-hidden:focus-within:translate-y-0",
        className,
      )}
    >
      {children}
    </header>
  );
}
