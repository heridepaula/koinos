import type { EducationUntil } from "./constants";
import type { HealthLevel } from "./health";

/** De onde vem o rendimento da conta: o DY dos ativos ou, sem ele, o de referência (9,5% a.a.). */
export type YieldSource = "dy" | "reference";

/** O plano salvo (v2): tudo em reais de hoje. */
export type IndependencePlan = {
  currentAge: number;
  targetAge: number;
  /** Patrimônio fora do Koinos, somado ao da carteira. */
  externalWealth: number;
  /** Gasto mensal fixo: moradia, contas, mercado, cartões. */
  essentialMonthly: number;
  /** IPVA, IPTU, seguros e manutenção, por ano. */
  seasonalYearly: number;
  /** Viagens e lazer extra, por ano. */
  travelYearly: number;
  /** Idade do cônjuge hoje; null sem cônjuge no orçamento. */
  spouseAge: number | null;
  /** Dependentes financeiros (0 sem). */
  dependents: number;
  /** Idade do dependente mais novo hoje; null sem dependentes. */
  youngestAge: number | null;
  /** Escola, cursos e van por mês, de todos os dependentes. */
  educationMonthly: number;
  educationUntil: EducationUntil;
  healthLevel: HealthLevel;
};

/** A conta da meta e do prazo (spec v2 §2.3 a §2.5), em reais de hoje. */
export type IndependenceSummary = {
  /** Essencial + sazonais ÷ 12 + viagens ÷ 12. */
  perpetualIncome: number;
  /** Renda perpétua ÷ r. */
  incomeCapital: number;
  /** Mensalidade do titular na idade alvo. */
  titularHealthNow: number;
  titularHealth: number;
  /** Idade do cônjuge na idade alvo; null sem cônjuge. */
  spouseAgeAtTarget: number | null;
  spouseHealth: number;
  /** As idades em que a mensalidade do titular sobe, depois da idade alvo. */
  healthStepAges: number[];
  perpetual: number;
  educationFund: number;
  childrenHealthFund: number;
  temporary: number;
  target: number;
  /** De onde veio o rendimento da conta: o DY de 12 meses dos ativos ou o de referência. */
  yieldSource: YieldSource;
  /** O rendimento anual usado (o DY ou o de referência). */
  annualYield: number;
  /** O mesmo por mês: o anual ÷ 12. */
  monthlyYieldRate: number;
  /**
   * O crescimento real do patrimônio por mês enquanto acumula (spec v2 §2.5): todo o rendimento é
   * reinvestido, descontada a inflação que os 24% repõem (`accumulationRate`).
   */
  accumulationRate: number;
  /** O que a meta recebe por mês no usufruto: a meta × o rendimento mensal (spec v2 §2.7). */
  monthlyYield: number;
  /** 24% do que a meta recebe, reinvestidos para repor a inflação. */
  reinvestment: number;
  /** O resto, para viver. */
  livingIncome: number;
  koinosWealth: number;
  externalWealth: number;
  patrimony: number;
  /** Patrimônio ÷ meta; pode passar de 1. */
  progress: number;
  /** Aporte médio mensal do bolso (12 meses fechados, menos as vendas). */
  monthlyAporte: number;
  /** A taxa real que dimensiona a meta (`REAL_MONTHLY_RATE`). */
  realRate: number;
  /** Meses até a meta: 0 quando alcançada, null sem prazo nesse ritmo. */
  months: number | null;
  /** AAAA-MM estimado, ou null sem prazo. */
  targetMonth: string | null;
  /** Idade atual + ⌊meses ÷ 12⌋; null sem prazo. */
  predictedAge: number | null;
  /** Meses de sobra antes da idade alvo, quando o prazo cai antes dela. */
  slackMonths: number | null;
  /** Aporte mensal que chegaria à meta na idade alvo, quando o ritmo atual não chega. */
  requiredAporte: number | null;
};

/** O DTO da página. */
export type IndependenceView = {
  plan: IndependencePlan | null;
  /** Um plano da v1, convertido para preencher o questionário; null sem plano antigo. */
  draft: IndependencePlan | null;
  summary: IndependenceSummary | null;
  /** Para o resumo do questionário (calculado no cliente pelas mesmas funções puras). */
  koinosWealth: number;
  monthlyAporte: number;
  /** O DY de 12 meses da carteira (fração ao ano); null sem DY nos ativos. */
  portfolioYield: number | null;
  currentMonth: string;
};
