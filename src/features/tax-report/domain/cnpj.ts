/** Só os dígitos de um CNPJ digitado ou colado. */
export function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

/** Confere os dois dígitos verificadores (módulo 11). Repetidos como 111…1 não valem. */
export function isValidCnpj(value: string): boolean {
  const d = digitsOf(value);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const check = (size: number): number => {
    let sum = 0;
    let weight = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += Number(d[size - i]) * weight--;
      if (weight < 2) weight = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === Number(d[12]) && check(13) === Number(d[13]);
}

/** `33000167000101` → `33.000.167/0001-01`; outro tamanho volta como veio. */
export function formatCnpj(value: string): string {
  const d = digitsOf(value);
  if (d.length !== 14) return value;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/** A máscara do CNPJ enquanto se digita: `33000` → `33.000`; só os 14 primeiros dígitos contam. */
export function maskCnpj(value: string): string {
  const d = digitsOf(value).slice(0, 14);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)];
  let out = parts[0];
  if (parts[1]) out += `.${parts[1]}`;
  if (parts[2]) out += `.${parts[2]}`;
  if (parts[3]) out += `/${parts[3]}`;
  if (parts[4]) out += `-${parts[4]}`;
  return out;
}
