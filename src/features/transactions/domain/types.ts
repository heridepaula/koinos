export type TransactionType = "BUY" | "SELL";

export const TRANSACTION_SOURCES = ["MANUAL", "PLANILHA", "B3"] as const;
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];

/**
 * O que originou o lançamento. O livro-razão só conhece compra e venda: subscrição é compra,
 * desdobro é compra a preço 0, bonificação é compra pelo custo que a empresa atribui e
 * incorporação é venda da origem + compra do destino pelo mesmo custo.
 */
export const TRANSACTION_KINDS = [
  "NEGOCIO",
  "SUBSCRICAO",
  "DESDOBRO",
  "BONIFICACAO",
  "INCORPORACAO",
  "FRACAO",
  "POSICAO_ANTERIOR",
] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

/** De onde veio o preço de um lançamento importado. */
export const PRICE_SOURCES = ["B3", "PLANILHA", "USUARIO", "ESTIMADO"] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];

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
  /** Ausente nos lançamentos antigos: vale como negócio. */
  kind?: TransactionKind;
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

/** Venda processada pelo preço médio vigente: o que entrou e o custo que saiu da posição. */
export type RealizedSale = {
  entryId: string;
  ticker: string;
  date: Date;
  kind: TransactionKind;
  /** Cotas baixadas: numa venda maior que a posição, só as que existiam. */
  quantity: number;
  /** Quantidade × preço, menos as taxas proporcionais às cotas baixadas. */
  proceeds: number;
  /** Quantidade × preço médio vigente. */
  cost: number;
};

/**
 * Provento recebido, como a B3 informa no extrato de Movimentação. `ALUGUEL` é a taxa do aluguel
 * (linha "Empréstimo" com valor). No `JCP`, `amount` já vem líquido dos 15% e `perShare` é o bruto.
 */
export const DIVIDEND_KINDS = ["RENDIMENTO", "REEMBOLSO", "DIVIDENDO", "JCP", "ALUGUEL"] as const;
export type DividendKind = (typeof DIVIDEND_KINDS)[number];

/** Nome de cada tipo de provento na tela. */
export const DIVIDEND_KIND_LABELS: Record<DividendKind, string> = {
  RENDIMENTO: "Rendimento",
  REEMBOLSO: "Reembolso",
  DIVIDENDO: "Dividendo",
  JCP: "JCP",
  ALUGUEL: "Aluguel",
};

export type DividendEntry = {
  ticker: string;
  /** Data do pagamento (meia-noite UTC, como as datas de negócio). */
  paidAt: Date;
  kind: DividendKind;
  amount: number;
  quantity: number | null;
  perShare: number | null;
};
