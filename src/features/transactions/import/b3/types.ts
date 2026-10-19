import type {
  DividendEntry,
  LedgerEntry,
  PriceSource,
  TransactionKind,
  TransactionSource,
  TransactionType,
} from "../../domain/types";
import type { RowError } from "../parse-planilha";

export type B3FileKind = "NEGOCIACAO" | "MOVIMENTACAO" | "PLANILHA";

/** Uma linha do extrato de Negociação (já com o código normal no lugar do fracionário). */
export type B3Trade = {
  row: number;
  date: Date;
  type: TransactionType;
  ticker: string;
  quantity: number;
  unitPrice: number;
};

export type NegociacaoData = {
  trades: B3Trade[];
  /** Linhas fora do mercado à vista (opções, termo...). */
  otherMarkets: number;
  rowErrors: RowError[];
  firstDate: Date | null;
  lastDate: Date | null;
};

/** Uma linha do extrato de Movimentação, sem interpretação. */
export type MovementRow = {
  row: number;
  credit: boolean;
  date: Date;
  /** Tipo da movimentação, como a B3 escreve (ex.: "Recibo de Subscrição"). */
  kind: string;
  /** Código do produto (antes de " - "), ex.: SNCI13 ou "Tesouro Selic 2027". */
  code: string;
  quantity: number | null;
  unitPrice: number | null;
  value: number | null;
};

export type MovimentacaoData = {
  rows: MovementRow[];
  rowErrors: RowError[];
  firstDate: Date | null;
  lastDate: Date | null;
};

/** Tipo do ativo no catálogo da brapi; null quando o código não está no catálogo. */
export type AssetTypeInfo = { type: string | null; subType: string | null };

/** Lançamento atual da carteira, como o plano precisa enxergar. */
export type ExistingTransaction = LedgerEntry & {
  source: TransactionSource;
  kind: TransactionKind;
  priceSource: PriceSource | null;
  relatedTicker: string | null;
  notes: string | null;
};

/** Lançamento que o plano manda gravar (sempre com `source: "B3"`). */
export type PlannedTransaction = {
  ticker: string;
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  fees: number;
  date: Date;
  kind: TransactionKind;
  priceSource: PriceSource | null;
  relatedTicker: string | null;
  notes: string | null;
};

export type B3ImportAnswers = {
  /** Preço por pendência (`sub:…` e `prev:…`). */
  prices?: Readonly<Record<string, number>>;
  /** Pendências cujo preço é uma estimativa (carga feita pelo script). */
  estimated?: readonly string[];
  /** Origem de cada conversão (`conv:…`): o ticker de origem ou "NONE" (não é conversão). */
  conversions?: Readonly<Record<string, string>>;
  /** FIIs que ficam de fora: o que já existe deles continua como está. */
  exclude?: readonly string[];
};

export type PendingItem =
  | {
      id: string;
      type: "PRECO_SUBSCRICAO";
      ticker: string;
      date: Date;
      quantity: number;
      price: number | null;
      priceSource: PriceSource | null;
    }
  | {
      id: string;
      type: "POSICAO_ANTERIOR";
      ticker: string;
      date: Date;
      quantity: number;
      price: number | null;
      priceSource: PriceSource | null;
    }
  | {
      id: string;
      type: "CONVERSAO";
      ticker: string;
      date: Date;
      quantity: number;
      /** Origem respondida (ou "NONE"); null enquanto ninguém confirmou. */
      source: string | null;
      suggestion: string | null;
      candidates: string[];
    };

export type TickerStatus = "OK" | "PENDENTE" | "FORA";

export type TickerPlan = {
  ticker: string;
  /** FIIs ligados por incorporação entram ou ficam de fora juntos. */
  group: string[];
  status: TickerStatus;
  reasons: string[];
  quantity: number;
  averagePrice: number;
  realizedPnL: number;
  counts: Partial<Record<TransactionKind, number>>;
  /** Código fora do catálogo da brapi (ex.: FII que saiu da bolsa). */
  outOfCatalog: boolean;
  /** Lançamentos atuais no período que a B3 não confirma (FII sem nenhuma linha nos extratos). */
  unconfirmed: number;
};

export type DividendCheckItem = {
  ticker: string;
  month: string;
  official: number;
  rebuilt: number;
  reason: string | null;
};

export type DividendCheck = {
  months: number;
  matched: number;
  explained: DividendCheckItem[];
  unexplained: DividendCheckItem[];
};

/** Provento que o plano manda gravar (sempre com `source: "B3"`). */
export type PlannedDividend = DividendEntry;

export type PlannedDividends = {
  /** Período do extrato de Movimentação: os proventos destes FIIs nele são trocados. */
  period: { start: Date; end: Date };
  /**
   * FIIs cujos proventos dentro de `period` são trocados: os do plano com status OK e os que só
   * aparecem pelos proventos. Os FORA, os PENDENTE e os deixados de fora mantêm o que já têm.
   */
  tickers: string[];
  inserts: PlannedDividend[];
};

export type B3DividendChanges = B3ImportChanges;

export type B3ImportPlan = {
  period: { start: Date; end: Date };
  /** Data das posições anteriores ao extrato (véspera da data mais antiga dos arquivos). */
  priorDate: Date;
  tickers: TickerPlan[];
  pending: PendingItem[];
  inserts: PlannedTransaction[];
  removeIds: string[];
  removedBySource: Partial<Record<TransactionSource, number>>;
  ignored: { reason: string; codes: string[] }[];
  warnings: string[];
  check: DividendCheck;
  dividends: PlannedDividends;
  totals: Partial<Record<TransactionKind, number>>;
};

export type B3ImportChanges = { added: number; removed: number; unchanged: number };

/** Prévia que vai para a tela: os lançamentos viram contagens, sem ids internos. */
export type B3ImportPreview = Omit<B3ImportPlan, "inserts" | "removeIds" | "dividends"> & {
  files: B3FileKind[];
  changes: B3ImportChanges;
  dividendChanges: B3DividendChanges;
  /** Algum FII ainda depende de resposta. */
  blocked: boolean;
};

/** O que a importação mudou de fato: as mesmas contagens líquidas que a prévia mostrou. */
export type B3ImportResult = Pick<B3ImportPreview, "changes" | "dividendChanges">;
