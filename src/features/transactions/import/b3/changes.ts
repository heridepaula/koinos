import type { DividendEntry } from "../../domain/types";
import type {
  B3ImportPlan,
  ExistingDividend,
  ExistingTransaction,
  PlannedDividends,
  PlannedForecast,
  PlannedTransaction,
  Replacement,
} from "./types";

// Diferença entre o plano e o que está gravado (spec atualizacao-b3, §4.2). Pura: o serviço da
// atualização usa o resultado na prévia e para gravar só o que muda.

/** O que a gravação faz e o que a prévia mostra de uma categoria (lançamentos ou proventos). */
export type Diff<Planned, Stored> = {
  /** O que entra: os novos e os que substituem um gravado. */
  insert: Planned[];
  /** Ids do que sai: os gravados sem um igual no plano. */
  removeIds: string[];
  /** Gravados que têm um igual no plano: ficam como estão, com o mesmo `_id`. */
  unchanged: number;
  /** Para a prévia: os que entram sem formar par com um que sai. */
  added: Planned[];
  /** Para a prévia: cada um que sai, com o que entra no lugar dele (ou null). */
  replaced: Replacement<Stored, Planned>[];
};

/**
 * Multiconjunto: as repetições contam (o mesmo FII em duas corretoras paga duas linhas iguais).
 * Só um gravado `matchable` pode ficar; os outros saem mesmo com um igual no plano.
 */
function diff<Planned, Stored extends { id: string }>(
  planned: readonly Planned[],
  removable: readonly Stored[],
  matchable: (item: Stored) => boolean,
  signature: (item: Planned | Stored) => string,
  pairKey: (item: Planned | Stored) => string,
): Diff<Planned, Stored> {
  const pool = new Map<string, string[]>();
  for (const item of removable) {
    if (!matchable(item)) continue;
    const key = signature(item);
    pool.set(key, [...(pool.get(key) ?? []), item.id]);
  }
  const kept = new Set<string>();
  const insert: Planned[] = [];
  for (const item of planned) {
    const id = pool.get(signature(item))?.shift();
    if (id) kept.add(id);
    else insert.push(item);
  }
  const removed = removable.filter((item) => !kept.has(item.id));
  // Par da prévia: o primeiro inserido ainda livre com a mesma chave (FII, tipo e data).
  const free = [...insert];
  const replaced = removed.map((before) => {
    const index = free.findIndex((item) => pairKey(item) === pairKey(before));
    return { before, after: index >= 0 ? free.splice(index, 1)[0]! : null };
  });
  return {
    insert,
    removeIds: removed.map((item) => item.id),
    unchanged: kept.size,
    added: free,
    replaced,
  };
}

// --- Lançamentos ------------------------------------------------------------------------------

type LedgerFields = Pick<
  PlannedTransaction,
  | "ticker"
  | "type"
  | "quantity"
  | "unitPrice"
  | "fees"
  | "date"
  | "kind"
  | "priceSource"
  | "relatedTicker"
  | "notes"
>;

const ledgerSignature = (entry: LedgerFields) =>
  [
    entry.ticker,
    entry.type,
    entry.quantity,
    entry.unitPrice,
    entry.fees,
    entry.date.toISOString(),
    entry.kind,
    entry.priceSource ?? "",
    entry.relatedTicker ?? "",
    entry.notes ?? "",
  ].join("|");

const ledgerPairKey = (entry: LedgerFields) =>
  `${entry.ticker}|${entry.type}|${entry.date.toISOString()}`;

/**
 * Lançamentos: o plano troca tudo o que está em `removeIds` por `inserts`. Um lançamento da B3
 * com um igual no plano fica; os manuais e os da planilha no período sempre saem (a B3 manda).
 */
export function diffLedger<Stored extends ExistingTransaction>(
  plan: Pick<B3ImportPlan, "inserts" | "removeIds">,
  existing: readonly Stored[],
): Diff<PlannedTransaction, Stored> {
  const removing = new Set(plan.removeIds);
  return diff(
    plan.inserts,
    existing.filter((entry) => removing.has(entry.id)),
    (entry) => entry.source === "B3",
    ledgerSignature,
    ledgerPairKey,
  );
}

// --- Proventos (spec proventos, §3.1) ----------------------------------------------------------

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

const dividendPairKey = (item: DividendEntry) =>
  `${item.ticker}|${item.kind}|${item.paidAt.toISOString()}`;

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
 * grava, pois um provento fora do escopo não seria comparado num reenvio (ficaria repetido) e,
 * com `tickers` vazio, seria descartado sem aviso.
 */
export function hasDividendOutsideScope(planned: PlannedDividends): boolean {
  const isInScope = scopeTest(planned);
  return planned.inserts.some((item) => !isInScope(item));
}

/**
 * Proventos: no escopo da troca (os FIIs de `planned.tickers`, com `paidAt` dentro de
 * `planned.period`), valem os do extrato. O que está fora do escopo fica como está.
 */
export function diffDividends<Stored extends ExistingDividend>(
  planned: PlannedDividends,
  existing: readonly Stored[],
): Diff<DividendEntry, Stored> {
  return diff(
    planned.inserts,
    existing.filter(scopeTest(planned)),
    () => true,
    dividendSignature,
    dividendPairKey,
  );
}

// --- A receber ---------------------------------------------------------------------------------

const forecastSignature = (item: PlannedForecast) =>
  [
    item.ticker,
    item.kind,
    item.payDate?.toISOString() ?? "",
    item.quantity ?? "",
    item.perShare ?? "",
    item.amount,
  ].join("|");

/** A foto nova tem os mesmos itens da gravada? A data da foto não conta. */
export function sameForecast(
  stored: readonly PlannedForecast[],
  next: readonly PlannedForecast[],
): boolean {
  if (stored.length !== next.length) return false;
  const pool = new Map<string, number>();
  for (const item of stored) {
    const key = forecastSignature(item);
    pool.set(key, (pool.get(key) ?? 0) + 1);
  }
  return next.every((item) => {
    const key = forecastSignature(item);
    const left = pool.get(key) ?? 0;
    pool.set(key, left - 1);
    return left > 0;
  });
}
