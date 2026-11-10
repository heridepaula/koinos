// O impacto de um aporte antes de enviá-lo (spec 2026-11-10-impacto-do-aporte): por papel, o preço
// médio, o L/P %, o YOC e a renda por mês a mais; no geral, o patrimônio e a renda somada. É uma
// conta sobre as ordens que os motores já devolveram e nunca volta a eles.

/** A classe da ordem. */
export type ImpactKind = "FII" | "ACAO";

/** O que o impacto lê de um ativo: os campos que `CascadeAsset` e `StockBuyAsset` têm. */
export type ImpactAsset = {
  quantity: number;
  averagePrice?: number | null;
  /** Último provento por cota. Só os FIIs o usam para a renda (pagam por mês). */
  lastDividend?: number | null;
  /** Proventos por cota nos últimos 12 meses. */
  dividends12m?: number | null;
};

export type ImpactOrder = { quantity: number; price: number; total: number };

export type OrderImpact = {
  quantityBefore: number;
  quantityAfter: number;
  /** Null sem posição ou sem preço médio. */
  averagePriceBefore: number | null;
  averagePriceAfter: number;
  /** Preço ÷ preço médio − 1. Antes null sem preço médio. */
  resultPercentBefore: number | null;
  resultPercentAfter: number;
  /** Proventos de 12 meses por cota ÷ preço médio. Null sem o dado. */
  yieldOnCostBefore: number | null;
  yieldOnCostAfter: number | null;
  /** FII: cotas × último provento; ação: ações × 12 meses ÷ 12. Null sem o dado. */
  monthlyIncome: number | null;
};

const positive = (value: number | null | undefined): number | null =>
  value != null && value > 0 ? value : null;

export function orderImpact(kind: ImpactKind, order: ImpactOrder, asset: ImpactAsset): OrderImpact {
  const before = asset.quantity;
  const after = before + order.quantity;
  const averageBefore = before > 0 ? positive(asset.averagePrice) : null;
  // Sem preço médio conhecido, a posição antiga não entra na conta: o depois é o preço da ordem.
  const averageAfter =
    averageBefore !== null && after > 0
      ? (before * averageBefore + order.quantity * order.price) / after
      : order.price;
  const income12m = positive(asset.dividends12m);
  const perMonth = kind === "FII" ? positive(asset.lastDividend) : income12m && income12m / 12;
  return {
    quantityBefore: before,
    quantityAfter: after,
    averagePriceBefore: averageBefore,
    averagePriceAfter: averageAfter,
    resultPercentBefore: averageBefore !== null ? order.price / averageBefore - 1 : null,
    resultPercentAfter: order.price / averageAfter - 1,
    yieldOnCostBefore:
      income12m !== null && averageBefore !== null ? income12m / averageBefore : null,
    yieldOnCostAfter: income12m !== null ? income12m / averageAfter : null,
    monthlyIncome: perMonth ? order.quantity * perMonth : null,
  };
}

export type PortfolioImpact = {
  /** O patrimônio das classes da visão, antes e depois das ordens. */
  valueBefore: number;
  valueAfter: number;
  /** A renda por mês a mais dos papéis com dado. */
  monthlyIncome: number;
  /** Quantas ordens ficaram sem o dado de proventos. */
  incomeMissing: number;
};

export function portfolioImpact(
  items: readonly { order: ImpactOrder; impact: OrderImpact }[],
  valueBefore: number,
): PortfolioImpact {
  let spent = 0;
  let monthlyIncome = 0;
  let incomeMissing = 0;
  for (const { order, impact } of items) {
    spent += order.total;
    if (impact.monthlyIncome === null) incomeMissing += 1;
    else monthlyIncome += impact.monthlyIncome;
  }
  return { valueBefore, valueAfter: valueBefore + spent, monthlyIncome, incomeMissing };
}
