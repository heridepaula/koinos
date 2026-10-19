import type { DividendEntry } from "../../domain/types";
import type { B3DividendChanges, PlannedDividends } from "./types";

// Comparação dos proventos do plano com os que já estão guardados (spec proventos, §3.1).
// Puro: o serviço da importação usa o resultado na prévia e para decidir se grava.

/** Os campos que identificam um provento: dois proventos com a mesma assinatura são iguais. */
export const dividendSignature = (item: DividendEntry): string =>
  [
    item.ticker,
    item.paidAt.toISOString(),
    item.kind,
    item.amount,
    item.quantity ?? "",
    item.perShare ?? "",
  ].join("|");

/**
 * O escopo da troca: o FII é um dos `tickers` e o pagamento cai dentro de `period` (inclusive).
 * Escrito em positivo, então uma data inválida fica fora do escopo.
 */
function scopeTest({ period, tickers }: Pick<PlannedDividends, "period" | "tickers">) {
  const scope = new Set(tickers);
  return (item: DividendEntry) =>
    scope.has(item.ticker) && item.paidAt >= period.start && item.paidAt <= period.end;
}

/**
 * Algum provento a gravar cai fora do escopo da troca? Com o plano isso não acontece: `tickers`
 * inclui todos os FIIs dos proventos e o período é o dos próprios extratos. É a trava de quem
 * chama o repositório direto, pois um provento fora do escopo não seria removido num reenvio
 * (ficaria repetido) e, com `tickers` vazio, seria descartado sem aviso.
 */
export function hasDividendOutsideScope(planned: PlannedDividends): boolean {
  const isInScope = scopeTest(planned);
  return planned.inserts.some((item) => !isInScope(item));
}

/**
 * Quantos proventos realmente mudam na troca do plano. Só conta o escopo da troca: os FIIs de
 * `planned.tickers`, com `paidAt` dentro de `planned.period` (inclusive). O resto fica como está.
 * Compara por assinatura, contando repetições (o mesmo FII em duas corretoras paga duas linhas
 * iguais), então reenviar os mesmos extratos dá `added = 0` e `removed = 0`.
 */
export function compareDividends(
  planned: PlannedDividends,
  existing: readonly DividendEntry[],
): B3DividendChanges {
  const { inserts } = planned;
  const isInScope = scopeTest(planned);
  const pool = new Map<string, number>();
  let storedInScope = 0;
  for (const item of existing) {
    if (!isInScope(item)) continue;
    storedInScope++;
    const key = dividendSignature(item);
    pool.set(key, (pool.get(key) ?? 0) + 1);
  }
  let unchanged = 0;
  for (const item of inserts) {
    const key = dividendSignature(item);
    const left = pool.get(key) ?? 0;
    if (left > 0) {
      pool.set(key, left - 1);
      unchanged++;
    }
  }
  return { added: inserts.length - unchanged, removed: storedInScope - unchanged, unchanged };
}
