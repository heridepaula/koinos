// Regras puras do relógio de cotações do navegador (spec 2026-11-16-atualizacao-automatica).

/** Primeira espera depois de uma tentativa que não trouxe cotação nova. */
export const BACKOFF_INITIAL_MS = 5 * 60_000;
/** O recuo dobra até aqui: o mesmo intervalo normal da brapi. */
export const BACKOFF_MAX_MS = 30 * 60_000;
/**
 * Sem interação há mais que isto, o relógio não dispara: a action renovaria a sessão (o Better
 * Auth empurra o prazo quando o cookie em cache vence) e uma aba esquecida nunca expiraria.
 */
export const IDLE_LIMIT_MS = 60 * 60_000;

/**
 * A tela ficou para trás do banco: outra aba, o `after()` ou o cron gravaram cotações mais novas
 * do que as que ela renderizou. Então vale um `router.refresh()`.
 */
export function needsRerender(renderedAt: Date | null, latestAt: Date | null): boolean {
  if (latestAt === null) return false;
  if (renderedAt === null) return true;
  return latestAt.getTime() > renderedAt.getTime();
}

/**
 * O recuo depois de uma tentativa. Cotação nova: zera. Sem avanço (falha, trava ocupada, ativo
 * sem cotação): 5 min, dobrando até 30 min. Evita o laço "venceu → chama de novo".
 */
export function nextBackoffMs(currentMs: number, advanced: boolean): number {
  if (advanced) return 0;
  if (currentMs <= 0) return BACKOFF_INITIAL_MS;
  return Math.min(currentMs * 2, BACKOFF_MAX_MS);
}

/** Não houve interação (clique, tecla, rolagem) nos últimos 60 min. */
export function isIdle(lastActivityAt: number, now: number): boolean {
  return now - lastActivityAt > IDLE_LIMIT_MS;
}
