import type { AssetClass, MarketSession } from "@/features/market-data";
import type { DividendMonths, PricePeriod } from "./asset-overview";
import type { AportePriority, CascadeAsset, StockBuyAsset } from "@/features/smart-buy";
import type { Bias, Category, CeilingCheck } from "@/features/strategy";
import type {
  DividendKind,
  MonthlyContribution,
  TransactionKind,
  TransactionType,
} from "@/features/transactions";

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
  /** Soma dos proventos por cota dos 12 meses de calendário que terminam no mês do último (Yahoo). */
  dividends12m: number | null;
  /** Quantos proventos entraram em `dividends12m`. Null sem dado. */
  dividendPayments12m: number | null;
  /** Quando os proventos foram buscados no Yahoo. Null se nunca. */
  dividendsFetchedAt: Date | null;
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
  rank: number | null;
  ceilingPrice: number | null;
  suggestedPercent: number | null;
  category: Category | null;
  bias: Bias | null;
};

export type PositionRow = {
  ticker: string;
  /** FII ou ação (spec ações etapa 1, §4); null para o que o app não classifica. */
  assetClass: AssetClass | null;
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
  rank: number | null;
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
  rank: number | null;
  ceilingPrice: number | null;
  suggestedPercent: number | null;
  category: Category | null;
  suggestedCategory: Category | null;
  /** Viés da casa de análise (Comprar/Aguardar), nas duas classes: Aguardar tira o ativo do aporte. */
  bias: Bias | null;
  price: number | null;
  marginToCeiling: number | null;
  suspiciousCeiling: boolean;
  /** O teto do ranking está a mais de 10% do calculado pela NTN-B (spec divergencia-teto). Só informativo. */
  ceilingCheck: CeilingCheck | null;
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
  /** FII ou ação: decide a regra do IR. */
  assetClass: AssetClass | null;
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
  /**
   * IR estimado, sem compensar prejuízos. FII: 20% do lucro da posição, sem isenção. Ação: 15% do
   * lucro de cada mês em que as vendas de ações passaram de R$ 20 mil. Zero no prejuízo.
   */
  estimatedTax: number;
  /** Ação com lucro só em meses isentos (vendas de ações até R$ 20 mil): a tela mostra "Isento". */
  taxExempt: boolean;
  /** FII que recebeu as cotas, quando foi uma incorporação que zerou a posição. */
  incorporatedInto: string | null;
  /** Algum preço de compra deste FII (ou do incorporado nele) foi estimado: o resultado também é. */
  estimatedPrice: boolean;
};

/** Linha das encerradas no dashboard: o resultado das vendas mais os proventos. */
export type ClosedPositionRow = {
  ticker: string;
  assetClass: AssetClass | null;
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
  /** Recebido nos últimos 12 meses fechados (sem o mês atual). */
  last12m: number;
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
  /** Renda mensal estimada × 12 ÷ investido. Null sem custo. */
  yieldOnCost: number | null;
  /** Renda mensal estimada ÷ média recebida por mês nos últimos 12 meses − 1. Null sem uma das duas. */
  incomeVsAverage: number | null;
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
  /** Entrada do Smart Buy de ações: o peso efetivo, reescalado para 100% como nos FIIs. */
  stockBuyInput: StockBuyAsset[];
  /** Nome e logo das ações da estratégia (inclusive as não detidas), para a tela de recomendações. */
  stockMeta: { ticker: string; name: string | null; logoUrl: string | null }[];
  /** Patrimônio de cada classe, na carteira inteira. */
  classValues: { FII: number; ACAO: number };
  allocation: { byCategory: AllocationSlice[]; byAsset: AllocationSlice[] };
  contributions: MonthlyContribution[];
  alerts: PortfolioAlert[];
  /** As 3 maiores altas e baixas do pregão entre as posições abertas da visão. */
  dayMovers: DayMovers;
  /** `market`: o mercado agora e o pregão da variação do dia (pela cotação mais recente). */
  quotes: { staleCount: number; lastFetchedAt: Date | null; market: MarketSession };
};

/** Uma posição entre as maiores altas ou baixas do pregão. */
export type DayMover = {
  ticker: string;
  name: string | null;
  logoUrl: string | null;
  assetClass: AssetClass | null;
  price: number | null;
  /** Variação do pregão, em fração. */
  changePercent: number;
  /** O que a posição ganhou ou perdeu no pregão, em R$. */
  amount: number;
};

export type DayMovers = { gainers: DayMover[]; losers: DayMover[] };

export type EvolutionPoint = {
  month: string;
  patrimony: number;
  invested: number;
  /** Algum preço do mês foi estimado (sem fechamento disponível). */
  estimated: boolean;
};

export type AdjustedResult = { withDividends: number; total: number };

/** Soma de um tipo de provento. */
export type KindAmount = { kind: DividendKind; amount: number };

export type UpcomingDividend = {
  ticker: string;
  /** Tipo do provento: o do extrato da B3; no anúncio do Yahoo, sempre Rendimento. */
  kind: DividendKind;
  /** Data ex do anúncio do Yahoo; null nos demais. */
  exDate: Date | null;
  /** Data com do anúncio do Fundamentus; null nos demais. */
  comDate: Date | null;
  quantity: number | null;
  perShare: number | null;
  amount: number;
  /**
   * Pagamento: a previsão oficial da B3, a data anunciada (Fundamentus) ou, no estimado, a data ex mais o intervalo habitual do
   * FII até o pagamento (15 dias sem histórico), porque o Yahoo não informa a data de pagamento. Null quando a B3 ainda não informou.
   */
  payBy: Date | null;
  /**
   * "B3": extrato de Eventos (Proventos a Receber); "FUNDAMENTUS": anúncio com a data de
   * pagamento da empresa; "YAHOO": anúncio, pagamento estimado.
   */
  source: "B3" | "FUNDAMENTUS" | "YAHOO";
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
  /** Soma por tipo, só os tipos com valor, na ordem de DIVIDEND_KINDS. */
  byKind: KindAmount[];
  /** Ativos que já pagaram no mês. */
  receivedAssets: number;
  /** O crédito mais recente do mês; null sem crédito. */
  lastReceived: { ticker: string; date: Date } | null;
  /** O recebido no mês anterior (créditos da B3). */
  previousMonth: number;
  /** Ativos com provento a receber no mês. */
  upcomingAssets: number;
  /** O próximo pagamento, de hoje em diante; null quando não há (ou todos já passaram). */
  nextUpcoming: { ticker: string; date: Date } | null;
  /** A data do último pagamento previsto no mês; null sem item. */
  lastUpcoming: Date | null;
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
  /** Soma por tipo, só os tipos com valor, na ordem de DIVIDEND_KINDS. */
  byKind: KindAmount[];
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
  /** Aporte e compras da classe no mês escolhido; null em Geral. A prévia da % rateia por ele. */
  currentClass: { aporte: number; purchaseCount: number } | null;
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

/** Ordem do ledger como a página do ativo mostra (sem id interno). */
export type AssetOrder = {
  date: Date;
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  fees: number;
  kind: TransactionKind;
};

/** Visão de um ativo: mercado (só o que já está guardado) e, se houver, estratégia e posição do dono. */
export type AssetOverview = {
  ticker: string;
  name: string | null;
  logoUrl: string | null;
  assetClass: AssetClass | null;
  price: number | null;
  /** Variação do dia: `amount` em R$ por cota, `percent` em fração (0,008 = 0,8%). */
  dailyChange: { amount: number; percent: number } | null;
  market: {
    priceToBook: number | null;
    dy12m: number | null;
    /** Proventos por cota nos 12 meses de calendário até o último pagamento (Yahoo). */
    dividends12m: number | null;
    lastDividend: { amount: number; exDate: Date } | null;
    segment: string | null;
    quoteFetchedAt: Date | null;
    /** O mercado agora e o pregão da variação do dia. */
    session: MarketSession;
  };
  /** Os períodos do gráfico de cotação que têm o que mostrar (ver `pricePeriods`). */
  pricePeriods: PricePeriod[];
  strategy: StrategyRow | null;
  position: PositionRow | null;
  /** Yield on cost dos 12 meses fechados antes do atual. Null sem posição. */
  yoc: number | null;
  closed: ClosedPositionRow | null;
  orders: AssetOrder[];
  received: { paidAt: Date; kind: DividendKind; amount: number; perShare: number | null }[];
  /** Os recebidos por mês nos 12 meses fechados: a mesma janela do yield on cost. */
  dividendMonths: DividendMonths;
  upcoming: UpcomingDividend[];
};

/** Um ativo da lista de `/ativos`: o que o dono tem ou acompanha na Carteira Alvo. */
export type WatchlistRow = {
  ticker: string;
  name: string | null;
  logoUrl: string | null;
  assetClass: AssetClass | null;
  price: number | null;
  /** Variação do dia em fração, como a cotação é guardada (0,008 = 0,8%). */
  changePercent: number | null;
  /** Os fechamentos diários recentes, terminando no preço atual, para o minigráfico. */
  spark: number[];
};

export type AssetWatchlist = {
  /** As posições abertas, da maior para a menor. */
  held: WatchlistRow[];
  /** Os ativos da estratégia sem posição, na ordem do ranking. */
  target: WatchlistRow[];
};
