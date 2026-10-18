/** Lê números digitados em pt-BR: "1.234,56", "98,50" e também "98.50". Vazio vira NaN. */
export function parseNumberInput(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return Number.NaN;
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  return Number(normalized);
}

/** Número para edição (vírgula decimal, sem separador de milhar). */
export function numberToInput(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value).replace(".", ",");
}
