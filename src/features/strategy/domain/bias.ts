// Viés de um ativo na Carteira Alvo (spec smart-buy-acoes, §5; nos FIIs desde a spec
// tabelas-unificadas): "Aguardar" tira o ativo das compras.
// Mesmos valores do StockBias do smart-buy; a feature de estratégia não importa o smart-buy.
export const BIASES = ["COMPRAR", "AGUARDAR"] as const;

export type Bias = (typeof BIASES)[number];

export const BIAS_LABELS: Record<Bias, string> = {
  COMPRAR: "Comprar",
  AGUARDAR: "Aguardar",
};
