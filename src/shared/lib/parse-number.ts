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
 * Máscara de moeda que enche a partir dos centavos, como a de um caixa eletrônico: só os dígitos
 * contam, e os dois últimos são os centavos ("1" vira "0,01", "1200000" vira "12.000,00").
 */
export function maskMoneyInput(text: string): string {
  const digits = text
    .replace(/\D/g, "")
    .replace(/^0+/, "")
    .slice(0, MONEY_MAX_INTEGER_DIGITS + 2)
    .padStart(3, "0");
  const integer = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${integer},${digits.slice(-2)}`;
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
  return maskMoneyInput(value.toFixed(2));
}
