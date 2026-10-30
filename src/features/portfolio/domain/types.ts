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
  /** P/VP do fechamento (usebolsai, às 2h). Null sem dado. */
  priceToBook: number | null;
  /** Soma dos proventos por cota dos últimos 12 meses (Yahoo). */
  dividends12m: number | null;
  /** Perfil do FII na usebolsai, para as travas de risco. Null sem dado. */
  fii: {
    /** Vacância física em % (5,2 = 5,2%). */
    vacancyPct: number | null;
    segment: string | null;
    fundType: string | null;
    paperPct: number | null;
    realEstatePct: number | null;
  } | null;
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

/**
 * FII que já esteve na carteira e hoje tem posição zerada: o resultado das vendas e o IR estimado.
 * Incorporação não é venda: não entra no custo nem no vendido, porque o custo segue para o destino.
 */
export type ClosedPosition = {
  ticker: string;
  /** Dia em que a posição zerou: a última venda ou, quando foi ela que zerou, a incorporação. */
  closedAt: Date;
  /** Quantas vendas de verdade (negócios e leilões de fração), somando todos os ciclos. */
  sales: number;
  /** Custo das cotas vendidas: o preço médio de cada venda × as cotas, com as taxas de compra. */
  costBasis: number;
  /** Valor das vendas, sem as taxas de venda. */
  proceeds: number;
  /** Vendido − custo. */
  realizedPnL: number;
  /** Resultado sobre o custo; null sem custo (sem venda). */
  realizedPct: number | null;
  /** 20% do lucro, sem isenção; zero no prejuízo. Por posição, sem compensar prejuízos. */
  estimatedTax: number;
  /** FII que recebeu as cotas, quando foi uma incorporação que zerou a posição. */
  incorporatedInto: string | null;
  /** Algum preço de compra deste FII (ou do incorporado nele) foi estimado: o resultado também é. */
  estimatedPrice: boolean;
};

/** Linha das encerradas no dashboard: o resultado das vendas mais os proventos. */
export type ClosedPositionRow = {
  ticker: string;
  realizedPnL: number;
  /** Proventos recebidos deste FII desde sempre. */
  dividends: number;
  /** Vendas + proventos: sem cotação, porque a posição está zerada. */
  totalResult: number;
  /** Dia em que a posição zerou; null para o FII que só aparece pelos proventos (sem lançamento). */
  closedAt: Date | null;
};

/** Somas das posições encerradas. */
export type ClosedPositionsTotals = {
  count: number;
  costBasis: number;
  proceeds: number;
  realizedPnL: number;
  estimatedTax: number;
  /** Soma das posições com lucro: a base do IR estimado. */
  profit: number;
  /** Soma das posições com prejuízo (negativa). */
  loss: number;
  withProfit: number;
  withLoss: number;
};

/** L/P de um período só pela cotação das posições abertas (ver period-results.ts). */
export type PeriodResult = {
  key: "semana" | "mes" | "ano";
  label: string;
  value: number;
  /** Sobre o valor das mesmas cotas no fechamento de referência; null sem base. */
  pct: number | null;
  /** FIIs fora da conta: sem cotação ou sem o fechamento de referência. */
  missing: string[];
};

export type DividendPace = {
  /** Ano atual, em São Paulo. */
  year: number;
  /** Média por mês dos últimos 12 meses fechados (sem o mês atual). */
  monthlyAverage12m: number;
  /** Recebido no ano atual, até hoje. */
  thisYear: number;
  /** Recebido no ano passado inteiro. */
  lastYear: number;
};

export type PortfolioSummary = {
  patrimony: number;
  invested: number;
  pnl: number;
  pnlPct: number | null;
  realizedPnL: number;
  /** Proventos recebidos de todos os FIIs, abertos ou encerrados, desde sempre. */
  dividendsReceived: number;
  dividendPace: DividendPace;
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
  closed: ClosedPositionRow[];
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
  /** Data ex do anúncio do Yahoo; null nos itens da B3, que não trazem essa data. */
  exDate: Date | null;
  quantity: number | null;
  perShare: number | null;
  amount: number;
  /**
   * Pagamento: a previsão oficial da B3 ou, no estimado, a data ex + 15 dias (o Yahoo não informa
   * a data de pagamento). Null quando a B3 ainda não informou.
   */
  payBy: Date | null;
  /** "B3": extrato de Eventos (Proventos a Receber); "YAHOO": anúncio, estimado. */
  source: "B3" | "YAHOO";
};

/** FII que paga todo mês e ainda não divulgou o provento deste mês. */
export type UndisclosedDividend = {
  ticker: string;
  /** Total pago no mês passado, como referência. */
  lastAmount: number;
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
  /** FIIs mensais da carteira sem provento divulgado neste mês. */
  undisclosed: (UndisclosedDividend & AssetMeta)[];
  byMonth: DividendMonthGroup[];
  byYear: DividendYearGroup[];
  byTicker: (DividendTickerGroup & AssetMeta)[];
  /** Os últimos 24 meses, com zero nos meses sem provento (para o gráfico). */
  chart: { month: string; amount: number }[];
  /** Mês (YYYY-MM) do primeiro provento recebido; null sem nenhum. */
  since: string | null;
  /** Algum provento da B3 já foi importado. */
  imported: boolean;
  /** Dia da foto do "a receber" da B3 (último envio do extrato de Eventos); null se nunca houve. */
  forecastAsOf: Date | null;
};

/** Compra paga em dinheiro (negócio ou subscrição), como o relatório de reinvestimento lista. */
export type MonthPurchase = {
  date: Date;
  ticker: string;
  kind: "NEGOCIO" | "SUBSCRICAO";
  quantity: number;
  unitPrice: number;
  fees: number;
  total: number;
};

/** Divisão do aporte do mês entre proventos reinvestidos e dinheiro do bolso. */
export type ReinvestmentSplit = {
  fromDividends: number;
  fromPocket: number;
  /** Proventos que a % mandaria reinvestir mas que não tiveram compra no mês. */
  unspent: number;
  /** Participação dos proventos no aporte; null sem aporte. */
  dividendsShare: number | null;
};

export type ReinvestmentMonth = ReinvestmentSplit & {
  month: string;
  aporte: number;
  /** Quantas compras em dinheiro o mês teve. */
  purchaseCount: number;
  dividends: number;
  percent: number;
  /** O mês não tem % salva: vale a padrão (100%). */
  isDefault: boolean;
};

/** Tela de reinvestimento: o mês escolhido, as compras dele e o histórico. */
export type ReinvestmentView = {
  month: string;
  /** Meses do seletor (do mais recente ao mais antigo): os com compra ou provento e o atual. */
  months: string[];
  current: ReinvestmentMonth;
  purchases: (MonthPurchase & AssetMeta)[];
  /** Os últimos 24 meses, do mais antigo ao mais recente. */
  history: ReinvestmentMonth[];
  last12: { aporte: number; fromDividends: number; share: number | null };
};

/** Tela de posições encerradas: as posições, da mais recente para a mais antiga, e as somas. */
export type ClosedPositionsView = {
  rows: (ClosedPosition & AssetMeta)[];
  totals: ClosedPositionsTotals;
};
