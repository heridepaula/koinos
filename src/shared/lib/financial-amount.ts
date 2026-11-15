/**
 * Lê um valor financeiro de um texto de origem externa (HTML do Fundamentus, células da B3), sem
 * chute: o que não for número claro vira null, nunca um número errado.
 *
 * - Com ponto e vírgula, o último é o separador decimal e o outro precisa agrupar de 3 em 3:
 *   "1.234,56" e "1,234.56" dão 1234,56; "1.23,4" é recusado.
 * - Só vírgula: "1,50" é decimal; várias vírgulas agrupando de 3 ("1,234,567") são milhar.
 * - Só ponto: "1234.56" e "1.5" são decimais; vários grupos de 3 ("1.234.567") são milhar. Um único
 *   grupo de 3 ("1.500") é ambíguo, e `dotOnly` decide (as fontes do app são pt-BR: milhar).
 * - Aceita "R$", espaços, "-" ou "−" na frente e (1,5) como negativo. Recusa vazio, "-", letras,
 *   notação científica, NaN e Infinity.
 */
export function parseFinancialAmount(
  text: string,
  options: { dotOnly?: "thousands" | "decimal" } = {},
): number | null {
  const dotOnly = options.dotOnly ?? "thousands";
  let rest = text.replace(/R\$/g, "").replace(/\s+/g, "");
  if (rest === "") return null;

  let negative = false;
  const parenthesized = /^\((.+)\)$/.exec(rest);
  if (parenthesized) {
    negative = true;
    rest = parenthesized[1]!;
  }
  if (/^[-−]/.test(rest)) {
    if (negative) return null;
    negative = true;
    rest = rest.slice(1);
  }
  if (!/^\d[\d.,]*$/.test(rest)) return null;

  const dots = rest.split(".").length - 1;
  const commas = rest.split(",").length - 1;
  const grouped = (sep: "." | ",") =>
    new RegExp(`^[1-9]\\d{0,2}(\\${sep}\\d{3})+$`).test(rest.split(sep === "." ? "," : ".")[0]!);
  let plain: string | null = null;

  if (dots > 0 && commas > 0) {
    const decimalSep = rest.lastIndexOf(".") > rest.lastIndexOf(",") ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";
    const parts = rest.split(decimalSep);
    if (parts.length === 2 && /^\d+$/.test(parts[1]!)) {
      const integer = parts[0]!;
      const ok = new RegExp(`^[1-9]\\d{0,2}(\\${thousandsSep}\\d{3})+$`).test(integer);
      if (ok) plain = `${integer.split(thousandsSep).join("")}.${parts[1]}`;
    }
  } else if (commas > 0) {
    if (commas === 1 && /^\d+,\d+$/.test(rest)) plain = rest.replace(",", ".");
    else if (commas > 1 && grouped(",")) plain = rest.split(",").join("");
  } else if (dots > 0) {
    if (dots > 1) {
      if (grouped(".")) plain = rest.split(".").join("");
    } else if (/^[1-9]\d{0,2}\.\d{3}$/.test(rest)) {
      plain = dotOnly === "thousands" ? rest.replace(".", "") : rest;
    } else if (/^\d+\.\d+$/.test(rest)) {
      plain = rest;
    }
  } else if (/^\d+$/.test(rest)) {
    plain = rest;
  }

  if (plain === null) return null;
  const value = Number(plain);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}
