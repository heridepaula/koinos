import { OTHERS_KEY, UNCATEGORIZED_KEY } from "../domain/allocation";

// A cor segue a entidade: cada categoria tem sempre o mesmo slot da paleta, no donut da alocação e
// na barra de composição do patrimônio.
const CATEGORY_SLOT: Record<string, number> = {
  FII_TIJOLO: 1,
  FII_PAPEL: 2,
  FII_HIBRIDO: 3,
  FII_FOF: 4,
  FIAGRO: 5,
  ACAO: 6,
  ETF: 7,
  OUTRO: 8,
};

/** Sem categoria e "Outros" ficam no cinza: não são uma entidade. */
export const NEUTRAL_COLOR = "var(--muted-foreground)";

export function categoryColor(key: string): string {
  if (key === OTHERS_KEY || key === UNCATEGORIZED_KEY) return NEUTRAL_COLOR;
  const slot = CATEGORY_SLOT[key];
  return slot ? `var(--chart-${slot})` : NEUTRAL_COLOR;
}
