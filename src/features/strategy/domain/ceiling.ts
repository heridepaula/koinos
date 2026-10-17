/** (teto − preço) / teto: positivo = abaixo do teto (margem de segurança). */
export function marginToCeiling(ceiling: number | null, price: number | null): number | null {
  if (ceiling === null || price === null || ceiling <= 0) return null;
  return (ceiling - price) / ceiling;
}

/** Teto muito longe do preço (menos da metade ou mais do dobro) costuma ser erro de digitação ou dado velho. */
export function isSuspiciousCeiling(ceiling: number | null, price: number | null): boolean {
  if (ceiling === null || price === null || price <= 0) return false;
  return ceiling < price * 0.5 || ceiling > price * 2;
}
