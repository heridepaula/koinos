import type { AssetClass } from "@/features/market-data";
import type { UnclassifiedDividend } from "./year-dividends";

/** As duas classes que o app acompanha. */
export type FiscalClass = AssetClass;

export type CnpjSource = "CVM_FCA" | "CVM_ISIN" | "MANUAL";

/** O que se sabe do emissor de um ativo. */
export type AssetIdentity = {
  name: string | null;
  legalName: string | null;
  cnpj: string | null;
  cnpjSource: CnpjSource | null;
};

export type ReceitaCode = { group: string; code: string; label: string; needsCheck?: boolean };

export type PositionFlag = "PRECO_ESTIMADO" | "POSICAO_ANTERIOR";

/** Uma linha da ficha Bens e Direitos. */
export type AssetFiscalPosition = {
  ticker: string;
  assetClass: FiscalClass;
  name: string | null;
  cnpj: string | null;
  quantityPrevious: number;
  costPrevious: number;
  quantity: number;
  cost: number;
  averagePrice: number;
  receita: ReceitaCode;
  /** Texto de modelo fixo; null enquanto faltar o CNPJ ou se a posição zerou. */
  discrimination: string | null;
  closedInYear: boolean;
  flags: PositionFlag[];
};

export type DividendSheet = "ISENTO" | "EXCLUSIVA";

/** Um grupo de proventos por fonte pagadora e ficha. */
export type DividendFiscalItem = {
  /** CNPJ formatado ou, sem CNPJ, o ticker. */
  sourceKey: string;
  tickers: string[];
  cnpj: string | null;
  sheet: DividendSheet;
  receita: ReceitaCode;
  /** Líquido recebido. */
  net: number;
  /** Bruto (JCP); nas demais é igual ao líquido. */
  gross: number;
  /** Imposto retido na fonte (JCP); zero nas demais. */
  withheld: number;
};

export type FiscalFlagCode =
  | "CNPJ_AUSENTE"
  | "PRECO_ESTIMADO"
  | "POSICAO_ANTERIOR"
  | "SALDO_PREJUIZO_NAO_INFORMADO"
  | "PROVENTO_REEMBOLSO"
  | "PROVENTO_NAO_CLASSIFICADO"
  | "ALUGUEL_NAO_CLASSIFICADO"
  | "RETENCAO_DIVIDENDO_POSSIVEL"
  | "JCP_FORA_DA_FAIXA"
  | "DAY_TRADE_NAO_APURADO"
  | "VENDA_ACIMA_ISENCAO";

export type FindingSeverity = "INFO" | "ATENCAO" | "CRITICO";

export type AuditFinding = {
  code: FiscalFlagCode;
  severity: FindingSeverity;
  ticker: string | null;
  /** AAAA-MM quando o achado é de um mês. */
  month: string | null;
  message: string;
};

/** Um mês de apuração de uma classe (swing trade). */
export type ApurationMonth = {
  month: string;
  assetClass: FiscalClass;
  /** Quantidade × preço de todas as vendas da classe (base da isenção das ações). */
  sold: number;
  /** Vendido líquido das taxas menos o custo: lucro ou prejuízo do mês. */
  result: number;
  exempt: boolean;
  lossCompensated: number;
  taxableBase: number;
  tax: number;
  lossBalanceAfter: number;
};

export type DarfMonth = { month: string; tax: number; due: number; carriedOut: number };

export type FiscalYearReport = {
  year: number;
  positions: AssetFiscalPosition[];
  exempt: DividendFiscalItem[];
  exclusive: DividendFiscalItem[];
  /** Reembolso, aluguel e o que não cabe numa ficha: fora delas até o dono conferir. */
  unclassified: UnclassifiedDividend[];
  apuration: {
    months: ApurationMonth[];
    darf: DarfMonth[];
    openingLoss: Record<FiscalClass, number>;
  };
  closingLoss: Record<FiscalClass, number>;
  findings: AuditFinding[];
};
