import type { EducationUntil } from "./constants";
import type { HealthLevel } from "./health";

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
  koinosWealth: number;
  externalWealth: number;
  patrimony: number;
  /** Patrimônio ÷ meta; pode passar de 1. */
  progress: number;
  /** Aporte médio mensal do bolso (6 meses fechados, menos as vendas). */
  monthlyAporte: number;
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
  currentMonth: string;
};
