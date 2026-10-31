// Visões por classe (spec etapa 2 das ações, §4). Puro: serve ao servidor e ao cliente.

export type ClassFilter = "TODOS" | "FII" | "ACAO";

/** Valores de `?classe=` na URL; sem o parâmetro, a página mostra Geral. */
export const CLASS_PARAMS = ["fiis", "acoes"] as const;
export type ClassParam = (typeof CLASS_PARAMS)[number];

const FILTER_OF_PARAM: Record<ClassParam, ClassFilter> = { fiis: "FII", acoes: "ACAO" };

const isClassParam = (value: string): value is ClassParam =>
  (CLASS_PARAMS as readonly string[]).includes(value);

/** `?classe=` da URL. Ausente ou desconhecido cai em Geral; repetido, vale o primeiro. */
export function parseClassParam(value: string | readonly string[] | null | undefined): ClassFilter {
  const raw = typeof value === "string" ? value : value?.[0];
  return raw && isClassParam(raw) ? FILTER_OF_PARAM[raw] : "TODOS";
}

/** A classe bate com o filtro. Classe desconhecida (null) conta como FII, como no snapshot. */
export function inClass(filter: ClassFilter, assetClass: string | null): boolean {
  if (filter === "TODOS") return true;
  return (filter === "ACAO") === (assetClass === "ACAO");
}

/** Os itens da classe do filtro; com "TODOS", todos. */
export function byClass<T extends { ticker: string }>(
  items: readonly T[],
  classOf: (ticker: string) => string | null,
  filter: ClassFilter,
): T[] {
  if (filter === "TODOS") return [...items];
  return items.filter((item) => inClass(filter, classOf(item.ticker)));
}
