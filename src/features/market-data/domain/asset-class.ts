// Classe do ativo no app (spec 2026-10-30-acoes-etapa-1, §4): FII (FIIs e Fiagros) ou ação
// (ações e units). Pura: decide pelo catálogo da brapi e, fora dele, pelo código.

export type AssetClass = "FII" | "ACAO";

/** Tipo e subtipo de um ticker no catálogo da brapi. */
export type CatalogType = { type: string | null; subType: string | null };

/** Cota de FII: 4 caracteres + 11. */
const FII_CODE = /^[A-Z0-9]{4}11$/;
/** Ação: 4 caracteres + 3 (ON) a 8 (PND). Direitos (1 e 2) e recibos (9 e 10) ficam de fora. */
const STOCK_CODE = /^[A-Z0-9]{4}[3-8]$/;

/**
 * FII ou ação; null para o que o app não acompanha (ETF, FI-Infra, FIP, FIDC, BDR, direitos,
 * recibos e renda fixa). `info` é a entrada do catálogo, ou null quando o ticker não está nele.
 */
export function assetClassOf(ticker: string, info: CatalogType | null): AssetClass | null {
  if (info) {
    if (info.type === "stock") return "ACAO";
    if (info.type !== "fund") return null;
    const subType = info.subType?.toLowerCase() ?? null;
    if (subType === "fii" || subType === "fi-agro") return "FII";
    return !subType && FII_CODE.test(ticker) ? "FII" : null;
  }
  // Fora do catálogo: quem saiu da bolsa (MALL11, NEOE3...).
  if (FII_CODE.test(ticker)) return "FII";
  if (STOCK_CODE.test(ticker)) return "ACAO";
  return null;
}
