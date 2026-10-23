// API pública da feature transactions para o cliente (regras puras e schemas).
export { computePositions, findOversells, replayLedger, sortLedger } from "./domain/positions";
export { monthlyContributions, type MonthlyContribution } from "./domain/contributions";
export type {
  DividendEntry,
  DividendKind,
  LedgerEntry,
  Oversell,
  Position,
  RealizedSale,
  TransactionType,
} from "./domain/types";
export {
  TICKER_REGEX,
  tickerSchema,
  transactionFormSchema,
  type TransactionFormInput,
} from "./schemas";
export {
  parsePlanilha,
  type ParsedPlanilha,
  type ParsedTarget,
  type ParsedTransaction,
  type RowError,
  type SheetInput,
} from "./import/parse-planilha";
export {
  selectValidTickers,
  type AcceptedTicker,
  type RejectedTicker,
} from "./import/select-valid";
export { detectB3File } from "./import/b3/detect";
export { readNegociacao } from "./import/b3/read-negociacao";
export { readMovimentacao } from "./import/b3/read-movimentacao";
export { readEventos } from "./import/b3/read-eventos";
export { B3ImportError, planB3Import, type PlanInput } from "./import/b3/plan";
export type {
  AssetTypeInfo,
  B3FileKind,
  B3ImportAnswers,
  B3ImportPlan,
  DividendCheck,
  EventoRow,
  EventosData,
  ExistingTransaction,
  PendingItem,
  PlannedDividend,
  PlannedDividends,
  PlannedForecast,
  PlannedTransaction,
  PlannedUpcoming,
  TickerPlan,
} from "./import/b3/types";
export {
  DIVIDEND_KINDS,
  PRICE_SOURCES,
  TRANSACTION_KINDS,
  TRANSACTION_SOURCES,
  type PriceSource,
  type TransactionKind,
  type TransactionSource,
} from "./domain/types";
