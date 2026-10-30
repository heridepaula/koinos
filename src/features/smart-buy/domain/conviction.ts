import type { RiskMacro } from "./risk";

// Tensores do Koinos 3.0: multiplicadores contínuos sobre o que falta para a meta. Os de valuation e
// de segurança aceleram os descontados; os de proventos e de vacância freiam quem perdeu fundamento.

/** Valuation: 1 + (1 − P/VP). P/VP 0,90 dá 1,10; 1,05 dá 0,95. Sem P/VP, 1. Nunca negativo. */
export function valuationTensor(priceToBook: number | null): number {
  if (priceToBook === null || !(priceToBook > 0)) return 1;
  return Math.max(0, 2 - priceToBook);
}

/**
 * Freio de corte: último provento ÷ média mensal dos últimos 12 meses, no máximo 1 (provento
 * extraordinário não acelera). Sem histórico, 1.
 */
export function dividendTensor(lastDividend: number | null, dividends12m: number | null): number {
  const ratio = dividendRatio(lastDividend, dividends12m);
  return ratio === null ? 1 : Math.min(1, ratio);
}

/** Último provento ÷ média mensal de 12 meses, sem teto (para explicar). Null sem histórico. */
export function dividendRatio(
  lastDividend: number | null,
  dividends12m: number | null,
): number | null {
  if (
    lastDividend === null ||
    !(lastDividend >= 0) ||
    dividends12m === null ||
    !(dividends12m > 0)
  ) {
    return null;
  }
  return lastDividend / (dividends12m / 12);
}

/** Segurança: 1 + margem até o teto, (teto − preço) ÷ teto. */
export function safetyTensor(marginToCeiling: number): number {
  return 1 + Math.max(0, marginToCeiling);
}

/** Vacância: 1 − vacância física, só em tijolo. Sem dado, 1. */
export function vacancyTensor(vacancy: number | null, macro: RiskMacro): number {
  if (macro !== "Tijolo" || vacancy === null || !(vacancy >= 0)) return 1;
  return Math.max(0, 1 - Math.min(1, vacancy));
}
