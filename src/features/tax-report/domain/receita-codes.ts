import type { FiscalClass, ReceitaCode } from "./types";

export type ReceitaCodes = {
  bens: Record<FiscalClass, ReceitaCode>;
  /** Fiagro: classe FII na apuração, mas código próprio de Bens e Direitos. */
  fiagro: ReceitaCode;
  dividendo: ReceitaCode;
  rendimentoFii: ReceitaCode;
  jcp: ReceitaCode;
};

/**
 * Códigos da DIRPF por ano-calendário (programa da Receita). `needsCheck` marca o que uma fonte
 * consultada em 2026-11-16 deu diferente (rendimento de FII: 26 ou 14): conferir no programa do
 * ano antes de declarar. Um ano novo entra como outra chave; os anteriores não mudam.
 */
const CODES: Record<number, ReceitaCodes> = {
  2025: {
    bens: {
      ACAO: { group: "03", code: "01", label: "Participações societárias: ações" },
      FII: { group: "07", code: "03", label: "Fundos: Fundo de Investimento Imobiliário (FII)" },
    },
    // Fonte divergente (consulta de 2026-11-16): a maioria dá Grupo 07, Código 02 para o Fiagro
    // (a tabela do InvestNews de 2022 lista "02 – Fiagro" e "03 – FII"), uma dá 03. Falta
    // conferir no programa do ano.
    fiagro: {
      group: "07",
      code: "02",
      label: "Fundos: Fundo de Investimento nas Cadeias Produtivas Agroindustriais (Fiagro)",
      needsCheck: true,
    },
    dividendo: { group: "Isentos", code: "09", label: "Lucros e dividendos recebidos" },
    rendimentoFii: {
      group: "Isentos",
      code: "26",
      label: "Outros (rendimentos de FII)",
      needsCheck: true,
    },
    jcp: { group: "Exclusiva", code: "10", label: "Juros sobre capital próprio" },
  },
};

/** Os códigos do ano, ou os do último ano anterior que a tabela conhece. */
export function receitaCodesFor(year: number): ReceitaCodes {
  const known = Object.keys(CODES)
    .map(Number)
    .filter((y) => y <= year)
    .sort((a, b) => b - a)[0];
  return CODES[known ?? 2025];
}
