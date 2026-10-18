// Leitura das células dos extratos da B3 (Área do Investidor, exportados em .xlsx).

/** Sem acento, minúsculo e sem espaços duplicados: compara cabeçalhos com segurança. */
export const normalizeHeader = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Índice de cada coluna pedida no cabeçalho, ou null se faltar alguma. */
export function findColumns<K extends string>(
  header: readonly unknown[],
  names: Record<K, string>,
): Record<K, number> | null {
  const normalized = header.map(normalizeHeader);
  const result = {} as Record<K, number>;
  for (const key of Object.keys(names) as K[]) {
    const index = normalized.indexOf(normalizeHeader(names[key]));
    if (index < 0) return null;
    result[key] = index;
  }
  return result;
}

/** "dd/mm/aaaa" (ou uma data do Excel) → meia-noite UTC do dia; null se inválida. */
export function parseB3Date(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const [, day, month, year] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCDate() === day && date.getUTCMonth() === month - 1 ? date : null;
}

/** Número da célula; "-" e vazio viram null. */
export function parseB3Number(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value ?? "").trim();
  if (text === "" || text === "-") return null;
  // "1.234,56" (pt-BR) ou "1234.56".
  const plain = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const number = Number(plain);
  return Number.isFinite(number) ? number : null;
}

export const cellText = (value: unknown) => String(value ?? "").trim();
