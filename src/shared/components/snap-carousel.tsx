"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * No iPhone (abaixo de 768 px), os filhos viram um carrossel com encaixe, como as pilhas de
 * widgets do iOS: cada card ocupa a largura menos 32 px (o próximo aparece na borda), a rolagem para em
 * cada um e os pontos embaixo dizem onde se está. A partir de 768 px o trilho some do layout
 * (display: contents) e os filhos voltam a ser itens da grade de `className`.
 */
export function SnapCarousel({ className, children }: { className?: string; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const count = Children.count(children);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const first = element.firstElementChild as HTMLElement | null;
      if (!first) return;
      const step = first.offsetWidth + parseFloat(getComputedStyle(element).columnGap || "0");
      setActive(Math.min(count - 1, Math.round(element.scrollLeft / step)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [count]);

  return (
    <div className={className}>
      <div
        ref={track}
        // -my-4/py-4: a rolagem corta o que passa da caixa, e a sombra dos cards precisa do respiro.
        className="-mx-4 -my-4 scrollbar-hide flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 py-4 *:w-[calc(100%-2rem)] *:shrink-0 *:snap-start md:contents md:*:w-auto"
      >
        {children}
      </div>
      {count > 1 ? (
        <div aria-hidden="true" className="flex justify-center gap-2 md:hidden">
          {Array.from({ length: count }, (_, index) => (
            <span
              key={index}
              className={cn(
                "size-1.5 rounded-full transition-colors duration-200",
                index === active ? "bg-foreground/70" : "bg-foreground/20",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
