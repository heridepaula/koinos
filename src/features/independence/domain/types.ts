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

/** Os custos de um mês, item a item. */
export type MonthlyCosts = {
  /** O gasto essencial com os 30% de imprevistos: o que a meta deixa livre para viver. */
  essential: number;
  /** Os gastos do ano (IPVA, IPTU, seguros, manutenção) ÷ 12. */
  seasonal: number;
  /** As viagens e o lazer do ano ÷ 12. */
  travel: number;
  /** O plano do titular e do cônjuge, cada um na faixa da sua idade na idade alvo. */
  health: number;
  /** A escola dos dependentes, quando o mais novo ainda é custeado na idade alvo. */
  education: number;
  /** O plano dos dependentes (quantos × a faixa do mais novo), nas mesmas condições. */
  childrenHealth: number;
};

/**
 * A conta da meta e do prazo (spec v2 §10): os custos de um mês no primeiro dia da aposentadoria,
 * em reais daquele dia, a meta que os paga pelo rendimento da carteira e o prazo até ela.
 */
export type IndependenceSummary = {
  /** Anos até a idade alvo, o primeiro dia da aposentadoria. */
  years: number;
  /** (1 + inflação geral)^anos: leva um custo de hoje ao primeiro dia. */
  inflationFactor: number;
  /** O mesmo pela inflação da educação, para a escola. */
  educationInflationFactor: number;
  /** Os custos de um mês em reais de hoje. */
  costsToday: MonthlyCosts;
  /** Os mesmos no primeiro dia da aposentadoria, em reais daquele dia. */
  costs: MonthlyCosts;
  /** Os custos do primeiro dia menos o essencial: o que sai do "para viver" antes da sobra. */
  otherCosts: number;
  /** Mensalidade do titular na faixa da idade alvo, em reais de hoje. */
  titularHealthNow: number;
  /** Idade do cônjuge na idade alvo; null sem cônjuge. */
  spouseAgeAtTarget: number | null;
  /** As idades em que a mensalidade do titular sobe depois da idade alvo (fora da meta). */
  healthStepAges: number[];
  /**
   * O patrimônio que, pelo rendimento da carteira, paga num mês os custos do primeiro dia e os 24%
   * reinvestidos, e deixa livre o essencial.
   */
  target: number;
  /** De onde veio o rendimento da conta: o DY de 12 meses dos ativos ou o de referência. */
  yieldSource: YieldSource;
  /** O rendimento anual usado (o DY ou o de referência). */
  annualYield: number;
  /** O mesmo por mês: o anual ÷ 12. É também o crescimento do patrimônio enquanto acumula. */
  monthlyYieldRate: number;
  /** O que a meta recebe por mês: a meta × o rendimento mensal. */
  monthlyYield: number;
  /** 24% do que a meta recebe, reinvestidos para repor a inflação. */
  reinvestment: number;
  /** Os 76% que pagam o mês: o essencial livre mais os outros custos. */
  livingIncome: number;
  /** O que fica livre para viver depois dos outros custos: o essencial do primeiro dia. */
  netLiving: number;
  koinosWealth: number;
  externalWealth: number;
  patrimony: number;
  /** Patrimônio ÷ meta; pode passar de 1. */
  progress: number;
  /**
   * Os proventos de um mês hoje, pelo mesmo rendimento (o patrimônio × o rendimento mensal). Com o
   * reinvestimento e o aporte, crescem todo mês até o que a meta recebe.
   */
  monthlyDividendsToday: number;
  /** Aporte médio mensal do bolso (12 meses fechados, menos as vendas). */
  monthlyAporte: number;
  /** Meses até a meta: 0 quando alcançada, null sem prazo nesse ritmo. */
  months: number | null;
  /** AAAA-MM estimado, ou null sem prazo. */
  targetMonth: string | null;
  /** Idade atual + ⌊meses ÷ 12⌋; null sem prazo. */
  predictedAge: number | null;
  /** Meses de sobra antes da idade alvo, quando o prazo cai antes dela. */
  slackMonths: number | null;
  /** Aporte do bolso por mês que chegaria à meta na idade alvo, quando o de hoje não chega. */
  requiredAporte: number | null;
  /** O que o bolso precisa pôr a mais por mês, além do aporte de hoje: o necessário − o de hoje. */
  extraAporte: number | null;
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
