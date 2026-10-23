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

/** Até R$ 999 bilhões: acima disso o número perde precisão de centavo. */
const MONEY_MAX_INTEGER_DIGITS = 12;

/**
 * Máscara de moeda enquanto se digita: milhar com ponto e até 2 casas depois da vírgula
 * ("14000,5" vira "14.000,5"). Só a primeira vírgula conta, e os pontos somem: a máscara
 * recoloca os de milhar. Para um ponto valer como decimal, o campo o troca por vírgula antes.
 */
export function maskMoneyInput(text: string): string {
  const commaAt = text.indexOf(",");
  const integer = (commaAt === -1 ? text : text.slice(0, commaAt))
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, MONEY_MAX_INTEGER_DIGITS);
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (commaAt === -1) return grouped;
  const decimals = text
    .slice(commaAt + 1)
    .replace(/\D/g, "")
    .slice(0, 2);
  return `${grouped || "0"},${decimals}`;
}

/** Lê o texto da máscara: ponto é milhar e vírgula é decimal ("14.000" é 14 mil). Vazio vira null. */
export function parseMoneyInput(text: string): number | null {
  const normalized = text.replace(/\./g, "").replace(",", ".");
  if (normalized === "" || normalized === ".") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Valor para o campo com máscara, sempre com centavos: 14000 vira "14.000,00". */
export function moneyToInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return maskMoneyInput(value.toFixed(2).replace(".", ","));
}
