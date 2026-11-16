import { useSyncExternalStore } from "react";

// Estado compartilhado entre o relógio do layout (QuoteClock) e o selo de cada página
// (QuoteRefresher): se há atualização em andamento e o pedido manual. Um módulo simples em vez
// de contexto, porque o relógio e o selo nascem em Suspense diferentes e não se aninham.

let pending = false;
let manualRefresh: (() => void) | null = null;
const listeners = new Set<() => void>();

export function setQuoteRefreshPending(value: boolean): void {
  if (pending === value) return;
  pending = value;
  for (const listener of listeners) listener();
}

/** O relógio registra aqui o que o botão manual dispara; devolve o cancelamento. */
export function registerManualQuoteRefresh(run: () => void): () => void {
  manualRefresh = run;
  return () => {
    if (manualRefresh === run) manualRefresh = null;
  };
}

/** O botão manual: força a tentativa, ignorando o recuo do relógio. */
export function requestManualQuoteRefresh(): void {
  manualRefresh?.();
}

export function useQuoteRefreshPending(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => pending,
    () => false,
  );
}
