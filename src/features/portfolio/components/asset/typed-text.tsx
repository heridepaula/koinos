"use client";

import { useEffect, useState } from "react";
import { cn } from "@/shared/lib/utils";

/** A pausa de "pensando" antes de começar a digitar. */
const THINK_MS = 900;
/** O texto inteiro leva por volta disso, seja curto ou longo (um parágrafo de ~400 caracteres). */
const TYPE_MS = 3200;
/** Pausa extra depois de pontuação, como quem digita e respira. */
const PAUSE_AFTER = /[.,;:!?]/;
const PAUSE_MS = 140;

type Phase = "thinking" | "typing" | "done";

/**
 * O texto da IA aparecendo como se fosse pensado e digitado: alguns instantes de "pensando…",
 * depois os caracteres um a um com o cursor piscando, com uma pausa breve na pontuação.
 *
 * - O espaço do texto inteiro fica reservado desde o início (uma cópia invisível na mesma célula da
 *   grade), então o card não cresce enquanto digita.
 * - Leitores de tela recebem o texto inteiro de uma vez; a animação é só visual (`aria-hidden`).
 * - Com movimento reduzido, o texto aparece pronto.
 */
export function TypedText({ text, className }: { text: string; className?: string }) {
  const [phase, setPhase] = useState<Phase>("thinking");
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text.length);
      setPhase("done");
      return;
    }
    setShown(0);
    setPhase("thinking");
    const perChar = TYPE_MS / Math.max(text.length, 1);
    let index = 0;
    let timer = window.setTimeout(function tick() {
      setPhase("typing");
      index += 1;
      setShown(index);
      if (index >= text.length) {
        setPhase("done");
        return;
      }
      // Um pouco de irregularidade, para não parecer uma máquina de escrever.
      const jitter = perChar * (0.5 + Math.random());
      const pause = PAUSE_AFTER.test(text[index - 1] ?? "") ? PAUSE_MS : 0;
      timer = window.setTimeout(tick, jitter + pause);
    }, THINK_MS);
    return () => window.clearTimeout(timer);
  }, [text]);

  return (
    <p className={cn("grid", className)}>
      <span className="sr-only">{text}</span>
      {/* Reserva a altura do texto inteiro: o card não pula enquanto digita. */}
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {text}
      </span>
      <span aria-hidden="true" className="col-start-1 row-start-1">
        {phase === "thinking" ? (
          <span className="text-muted-foreground">
            Pensando
            <span className="inline-block animate-pulse">…</span>
          </span>
        ) : (
          <>
            {text.slice(0, shown)}
            {phase === "typing" ? (
              <span className="ml-px inline-block h-[1.1em] w-0.5 translate-y-[0.15em] animate-pulse rounded-full bg-foreground/70 align-baseline" />
            ) : null}
          </>
        )}
      </span>
    </p>
  );
}
