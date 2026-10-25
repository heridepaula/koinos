// Índice de Convicção: dois multiplicadores ajustam quanto do que falta para a meta o FII pede neste
// aporte. Aceleram os descontados e freiam os caros, e só valem para quem está abaixo da meta.

/** Margem de segurança, (teto − preço) ÷ teto, acima de 5%: ×1,2. Até 5%: ×1,0. */
export function marginMultiplier(marginToCeiling: number): number {
  return marginToCeiling > 0.05 ? 1.2 : 1;
}

/**
 * P/VP (cotação ÷ valor patrimonial por cota): abaixo de 0,95, ×1,2; de 0,95 a 1,00, ×1,0; acima de
 * 1,00, ×0,5 (ágio). Sem P/VP, ×1,0: ainda não há fonte gratuita do valor patrimonial para todos os
 * FIIs (a brapi gratuita não tem, e a ligação da CVM ao ticker falhava sem a B3).
 */
export function priceToBookMultiplier(priceToBook: number | null): number {
  if (priceToBook === null || !(priceToBook > 0)) return 1;
  if (priceToBook < 0.95) return 1.2;
  if (priceToBook > 1) return 0.5;
  return 1;
}
