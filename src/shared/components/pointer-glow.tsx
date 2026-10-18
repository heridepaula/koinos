"use client";

import { useEffect } from "react";

/**
 * Brilho que segue o cursor: um só ouvinte no documento escreve a posição (--mx, --my) no
 * elemento [data-glow] sob o ponteiro. Em toque ou com movimento reduzido, não faz nada.
 */
export function PointerGlow() {
  useEffect(() => {
    const wanted = window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)");
    if (!wanted.matches) return;
    let target: HTMLElement | null = null;
    let frame = 0;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty("--mx", `${x - rect.left}px`);
      target.style.setProperty("--my", `${y - rect.top}px`);
    };
    const setTarget = (next: HTMLElement | null) => {
      if (next === target) return;
      target?.removeAttribute("data-glow-active");
      next?.setAttribute("data-glow-active", "");
      target = next;
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const element = event.target instanceof Element ? event.target : null;
      setTarget(element?.closest<HTMLElement>("[data-glow]") ?? null);
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onLeave = () => setTarget(null);

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
      setTarget(null);
    };
  }, []);
  return null;
}
