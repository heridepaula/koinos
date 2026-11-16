const MONEY = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const PRICE = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/** Arredonda ao centavo. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** `1234.5` → `1.234,50`, sem o "R$" (os textos da Receita já trazem). */
export function formatMoney(value: number): string {
  return MONEY.format(round2(value));
}

/** Preço médio: de 2 a 4 casas. */
export function formatPrice(value: number): string {
  return PRICE.format(value);
}
