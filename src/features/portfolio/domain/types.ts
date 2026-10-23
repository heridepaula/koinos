import type { AportePriority, CascadeAsset } from "@/features/smart-buy";
import type { Category } from "@/features/strategy";
import type { MonthlyContribution } from "@/features/transactions";

// DTOs entregues às telas. Nenhum carrega userId, portfolioId ou documento cru do banco.

export type PriceInfo = {
  name: string | null;
  logoUrl: string | null;
  subType: string | null;
  price: number | null;
  changePercent: number | null;
  quoteFetchedAt: Date | null;
  dy12m: number | null;
  lastDividend: { amount: number; exDate: Date } | null;
};

export type TargetConfig = {
  ticker: string;
  inStrategy: boolean;
  sunoRank: number | null;
  ceilingPrice: number | null;
  suggestedPercent: number | null;
  category: Category | null;
};

export type PositionRow = {
  ticker: string;
  name: string | null;
  logoUrl: string | null;
  category: Category | null;
  quantity: number;
  averagePrice: number;
  totalCost: number;
  price: number | null;
  currentValue: number;
  pnl: number;
  pnlPct: number | null;
  /** Proventos recebidos deste FII desde sempre. */
  dividends: number;
  /** L/P da cotação + proventos. */
  pnlWithDividends: number;
  /** L/P da cotação + proventos + vendas. */
  totalResult: number;
  /** Resultado realizado nas vendas deste FII, desde sempre. */
  realizedPnL: number;
  changePercent: number | null;
  dy12m: number | null;
  /** Peso na carteira inteira. */
  portfolioWeight: number;
  inStrategy: boolean;
  sunoRank: number | null;
  ceilingPrice: number | null;
  marginToCeiling: number | null;
  suspiciousCeiling: boolean;
  /** Peso dentro da estratégia (só para ativos na estratégia). */
  strategyWeight: number | null;
  targetWeight: number | null;
  priority: AportePriority | null;
};

export type StrategyRow = {
  ticker: string;
  name: string | null;
  logoUrl: string | null;
  configured: boolean;
  held: boolean;
  quantity: number;
  inStrategy: boolean;
  sunoRank: number | null;
  ceilingPrice: number | null;
  suggestedPercent: number | null;
  category: Category | null;
  suggestedCategory: Category | null;
  price: number | null;
  marginToCeiling: number | null;
  suspiciousCeiling: boolean;
  strategyWeight: number | null;
  targetWeight: number | null;
  priority: AportePriority | null;
};

export type ClosedPosition = {
  ticker: string;
  realizedPnL: number;
  /** Proventos recebidos deste FII desde sempre. */
  dividends: number;
  /** Vendas + proventos: sem cotação, porque a posição está zerada. */
  totalResult: number;
  lastDate: Date;
};

export type PortfolioSummary = {
  patrimony: number;
  invested: number;
  pnl: number;
  pnlPct: number | null;
  realizedPnL: number;
  /** Proventos recebidos de todos os FIIs, abertos ou encerrados, desde sempre. */
  dividendsReceived: number;
  /** L/P da cotação + proventos. */
  pnlWithDividends: number;
  /** L/P da cotação + proventos + vendas. */
  totalResult: number;
  dayChange: number;
  dayChangePct: number | null;
  dy12m: number | null;
  monthlyIncome: number;
  positionsCount: number;
};

export type AllocationSlice = { key: string; label: string; value: number; share: number };

export type PortfolioAlert = {
  id: string;
  level: "warning" | "info";
  title: string;
  detail: string;
};

export type PortfolioSnapshot = {
  summary: PortfolioSummary;
  positions: PositionRow[];
  closed: ClosedPosition[];
  strategy: {
    rows: StrategyRow[];
    strategyValue: number;
    sumOfSuggested: number;
    weightsWarning: string | null;
  };
  cascadeInput: CascadeAsset[];
  allocation: { byCategory: AllocationSlice[]; byAsset: AllocationSlice[] };
  contributions: MonthlyContribution[];
  alerts: PortfolioAlert[];
  quotes: { staleCount: number; lastFetchedAt: Date | null };
};

export type EvolutionPoint = {
  month: string;
  patrimony: number;
  invested: number;
  /** Algum preço do mês foi estimado (sem fechamento disponível). */
  estimated: boolean;
};

export type AdjustedResult = { withDividends: number; total: number };

export type UpcomingDividend = {
  ticker: string;
  exDate: Date;
  quantity: number;
  perShare: number;
  amount: number;
  /** Estimativa: o Yahoo não informa a data de pagamento. */
  payBy: Date;
};

export type DividendMonthSummary = {
  month: string;
  received: number;
  upcoming: number;
  total: number;
};

export type DividendMonthGroup = {
  month: string;
  total: number;
  byTicker: { ticker: string; amount: number }[];
};

export type DividendYearGroup = {
  year: string;
  total: number;
  months: number;
  monthlyAverage: number;
};

export type DividendTickerGroup = {
  ticker: string;
  total: number;
  payments: number;
  lastPaidAt: Date;
};

type AssetMeta = { name: string | null; logoUrl: string | null };

/** Tela de proventos: o mês atual, o que está a receber e o histórico agrupado. */
export type DividendsView = {
  month: DividendMonthSummary;
  upcoming: (UpcomingDividend &
    AssetMeta & {
      /** A data estimada de pagamento já passou e o extrato da B3 ainda não confirmou. */
      payByPassed: boolean;
    })[];
  byMonth: DividendMonthGroup[];
  byYear: DividendYearGroup[];
  byTicker: (DividendTickerGroup & AssetMeta)[];
  /** Os últimos 24 meses, com zero nos meses sem provento (para o gráfico). */
  chart: { month: string; amount: number }[];
  /** Mês (YYYY-MM) do primeiro provento recebido; null sem nenhum. */
  since: string | null;
  hasAny: boolean;
};
