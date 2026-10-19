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

export type ClosedPosition = { ticker: string; realizedPnL: number; lastDate: Date };

export type PortfolioSummary = {
  patrimony: number;
  invested: number;
  pnl: number;
  pnlPct: number | null;
  realizedPnL: number;
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
