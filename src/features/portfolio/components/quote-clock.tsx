"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { isIdle, needsRerender, nextBackoffMs, nextQuoteRefreshAt } from "@/features/market-data";
import { refreshMyQuotesAction } from "../actions";
import { registerManualQuoteRefresh, setQuoteRefreshPending } from "./quote-refresh-store";

/** O maior atraso que o setTimeout aceita (≈ 24,8 dias). */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll"] as const;
const SESSION_EXPIRED = /sess[aã]o expirada/i;

/**
 * O relógio das cotações (spec 2026-11-16-atualizacao-automatica-cotacoes-design): um só `setTimeout`
 * para o próximo instante em que a cotação vence (`nextQuoteRefreshAt`), que chama a action e
 * deixa o Next re-renderizar só o que mudou. Não desenha nada; fica no layout `(app)`, então vale
 * para todas as telas com preço.
 *
 * - Sem laço: depois de cada tentativa que não trouxe cotação nova, espera 5 min (dobra até 30).
 * - Aba oculta não dispara; ao voltar, atualiza na hora se venceu.
 * - Sem interação há 60 min não dispara (a action renovaria a sessão, e a aba abandonada não
 *   expiraria); a próxima interação retoma.
 * - A falha automática é silenciosa (log e recuo); sessão expirada para o relógio.
 */
export function QuoteClock({ lastFetchedAt }: { lastFetchedAt: Date | null }) {
  const router = useRouter();
  const fetchedMs = lastFetchedAt?.getTime() ?? null;
  // A cotação mais nova que se sabe: a da tela ou a que a última tentativa devolveu. Sem isso,
  // entre a resposta da action e o novo RSC o relógio veria "vencida" de novo e dispararia em laço.
  const knownMs = useRef<number | null>(fetchedMs);
  const renderedMs = useRef<number | null>(fetchedMs);
  const resume = useRef<(() => void) | null>(null);

  useEffect(() => {
    renderedMs.current = fetchedMs;
    knownMs.current = Math.max(knownMs.current ?? 0, fetchedMs ?? 0) || null;
    resume.current?.();
  }, [fetchedMs]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let backoffMs = 0;
    let backoffUntil = 0;
    let running = false;
    let stopped = false;
    let lastActivity = Date.now();

    const clear = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };

    const schedule = () => {
      clear();
      if (stopped || document.visibilityState === "hidden") return;
      const now = Date.now();
      if (isIdle(lastActivity, now)) return;
      const known = knownMs.current === null ? null : new Date(knownMs.current);
      const due = nextQuoteRefreshAt(known, new Date(now)).getTime();
      const delay = Math.min(Math.max(due, backoffUntil) - now, MAX_TIMEOUT_MS);
      timer = setTimeout(() => void attempt(false), Math.max(delay, 0));
    };

    const attempt = async (manual: boolean) => {
      if (running) return;
      if (!manual && (stopped || document.visibilityState === "hidden")) return;
      if (!manual && isIdle(lastActivity, Date.now())) return;
      running = true;
      clear();
      setQuoteRefreshPending(true);
      const before = knownMs.current === null ? null : new Date(knownMs.current);
      let advanced = false;
      try {
        const result = await refreshMyQuotesAction();
        if (result?.serverError) throw new Error(result.serverError);
        const data = result?.data;
        const latest = data?.lastFetchedAt ?? null;
        advanced = needsRerender(before, latest);
        if (latest) knownMs.current = Math.max(knownMs.current ?? 0, latest.getTime());
        // Outra aba, o after() ou o cron gravaram antes: a action não re-renderizou, a tela sim
        // ficou para trás. Se ela já chamou refresh(), não repetir.
        const shown = renderedMs.current === null ? null : new Date(renderedMs.current);
        if (!data?.rerendered && needsRerender(shown, latest)) router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (manual) toast.error(message);
        else {
          console.warn("[cotações] atualização automática falhou:", message);
          if (SESSION_EXPIRED.test(message)) stopped = true;
        }
      } finally {
        running = false;
        setQuoteRefreshPending(false);
      }
      backoffMs = nextBackoffMs(backoffMs, advanced);
      backoffUntil = backoffMs > 0 ? Date.now() + backoffMs : 0;
      schedule();
    };

    const onActivity = () => {
      const wasIdle = isIdle(lastActivity, Date.now());
      lastActivity = Date.now();
      if (wasIdle) schedule();
    };
    const onVisibility = () => schedule();

    resume.current = schedule;
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    const unregister = registerManualQuoteRefresh(() => {
      backoffMs = 0;
      backoffUntil = 0;
      void attempt(true);
    });
    schedule();

    return () => {
      stopped = true;
      clear();
      resume.current = null;
      unregister();
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return null;
}
