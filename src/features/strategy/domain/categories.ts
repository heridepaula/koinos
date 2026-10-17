export const CATEGORIES = [
  "FII_TIJOLO",
  "FII_PAPEL",
  "FII_HIBRIDO",
  "FII_FOF",
  "FIAGRO",
  "ACAO",
  "ETF",
  "OUTRO",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  FII_TIJOLO: "FII Tijolo",
  FII_PAPEL: "FII Papel",
  FII_HIBRIDO: "FII Híbrido",
  FII_FOF: "FII FoF",
  FIAGRO: "Fiagro",
  ACAO: "Ação",
  ETF: "ETF",
  OUTRO: "Outro",
};

/** Sugestão a partir do subtipo da brapi. FIIs ficam sem sugestão: tijolo/papel/híbrido/FoF é escolha do usuário. */
export function suggestCategory(subType: string | null): Category | null {
  switch (subType) {
    case "fi-agro":
      return "FIAGRO";
    case "etf":
      return "ETF";
    case "stock":
      return "ACAO";
    default:
      return null;
  }
}
