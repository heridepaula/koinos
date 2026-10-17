export type TransactionType = "BUY" | "SELL";

/** Um lançamento, do jeito que as regras de cálculo enxergam. */
export type LedgerEntry = {
  id: string;
  ticker: string;
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  fees: number;
  /** Data do negócio (meia-noite UTC). */
  date: Date;
  createdAt: Date;
};

export type Position = {
  ticker: string;
  quantity: number;
  /** Custo da posição aberta (preço médio × quantidade), pelo método da Receita. */
  totalCost: number;
  averagePrice: number;
  realizedPnL: number;
  firstDate: Date;
  lastDate: Date;
};

/** Venda maior que a posição existente na data. */
export type Oversell = {
  entryId: string;
  ticker: string;
  date: Date;
  sellQuantity: number;
  heldQuantity: number;
};
