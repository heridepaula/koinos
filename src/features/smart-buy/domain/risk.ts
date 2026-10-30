import type { Category } from "@/features/strategy";

// Travas de risco do Koinos 3.0: nenhum FII leva mais de 33% do aporte, nenhum setor mais de 35% e
// nenhuma macro (papel ou tijolo) mais de 60%.

/** Frações do aporte. */
export const RISK_CAPS = { asset: 0.33, sector: 0.35, macro: 0.6 } as const;

/** Papel e tijolo são as duas macros; FoF e o que não dá para classificar ficam em "Outros". */
export type RiskMacro = "Papel" | "Tijolo" | "Outros";

export type RiskInput = {
  /** Tipo do fundo na usebolsai: "Tijolo", "Papel", "Híbrido", "Fiagro", "Fundo de Fundos". */
  fundType: string | null;
  /** Segmento na usebolsai ("Shoppings", "Logística"…). */
  segment: string | null;
  /** % do ativo em recebíveis e em imóveis (composição do informe da CVM). */
  paperPct: number | null;
  realEstatePct: number | null;
  /** Categoria da Carteira Alvo: só vale quando a usebolsai não tem o tipo. */
  category: Category | null;
};

export type RiskBuckets = {
  macro: RiskMacro;
  /** Setor que divide o limite de 35% com outros FIIs. Null: não divide (só os limites do FII e da macro). */
  sector: string | null;
};

const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();

/**
 * Segmentos genéricos não formam setor: a CVM classifica metade dos FIIs como "Multicategoria" ou
 * "Outros" (todos os de papel, e até fundos de logística). Juntá-los num balde só travaria fundos
 * sem relação entre si.
 */
const GENERIC_SEGMENTS = new Set(["multicategoria", "outros", "hibrido", "titulos e val. mob."]);

function macroOf({ fundType, paperPct, realEstatePct, category }: RiskInput): RiskMacro {
  switch (fundType ? normalize(fundType) : null) {
    case "papel":
    case "fiagro":
      return "Papel";
    case "tijolo":
      return "Tijolo";
    case "hibrido":
      // Híbrido conta como papel só se for majoritariamente CRI (ou outros recebíveis).
      if (paperPct !== null || realEstatePct !== null) {
        return (paperPct ?? 0) > (realEstatePct ?? 0) ? "Papel" : "Tijolo";
      }
      break;
    case "fundo de fundos":
      return "Outros";
  }
  switch (category) {
    case "FII_PAPEL":
    case "FIAGRO":
      return "Papel";
    case "FII_TIJOLO":
      return "Tijolo";
    default:
      return "Outros";
  }
}

/**
 * Macro e setor de um FII. O setor (Shoppings, Logística…) só vale para tijolo: em papel, o segmento
 * da CVM não diz nada sobre o risco (o MXRF11, de recebíveis, vem como "Logística").
 */
export function classifyRisk(input: RiskInput): RiskBuckets {
  const macro = macroOf(input);
  const segment = input.segment?.trim() || null;
  const specific = segment !== null && !GENERIC_SEGMENTS.has(normalize(segment));
  return { macro, sector: macro === "Tijolo" && specific ? segment : null };
}
