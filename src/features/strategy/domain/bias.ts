// Viés de uma ação na Carteira Alvo (spec smart-buy-acoes, §5): "Aguardar" tira a ação das compras.
// Mesmos valores do StockBias do smart-buy; a feature de estratégia não importa o smart-buy.
export const BIASES = ["COMPRAR", "AGUARDAR"] as const;

export type Bias = (typeof BIASES)[number];

export const BIAS_LABELS: Record<Bias, string> = {
  COMPRAR: "Comprar",
  AGUARDAR: "Aguardar",
};
