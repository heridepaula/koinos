import "server-only";
import { availableParallelism } from "node:os";

/**
 * Paralelismo para tarefas de rede: usa os núcleos disponíveis da máquina,
 * com um teto para não sobrecarregar APIs externas.
 */
export function ioConcurrency(cap = 8): number {
  return Math.max(1, Math.min(cap, availableParallelism()));
}

/** Como Promise.all(items.map(fn)), mas com no máximo `limit` tarefas ao mesmo tempo. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return results;
}
