import "server-only";

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

/**
 * Semáforo compartilhado: no máximo `limit` tarefas ao mesmo tempo em todas as chamadas, mesmo
 * vindas de etapas diferentes que rodam em paralelo (o limite é por fonte, não por etapa).
 */
export function createLimiter(limit: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (running >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
    else running++;
    try {
      return await task();
    } finally {
      // A vaga passa direto para quem espera; sem fila, fica livre.
      const nextTask = waiting.shift();
      if (nextTask) nextTask();
      else running--;
    }
  };
}

/** Como Promise.all, mas só rejeita depois que todas terminam: nenhuma etapa fica gravando solta. */
export async function settleAll<T extends readonly unknown[]>(promises: {
  [K in keyof T]: Promise<T[K]>;
}): Promise<T> {
  const results = await Promise.allSettled(promises);
  const failure = results.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;
  return results.map((result) => (result as PromiseFulfilledResult<unknown>).value) as unknown as T;
}
