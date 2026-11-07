import type { HealthKey, LivingKey, PeopleKey, TravelKey } from "./catalog";

/** A opção escolhida em cada passo do questionário, para reabri-lo no mesmo lugar. */
export type PlanAnswers = {
  living: LivingKey;
  people: PeopleKey;
  health: HealthKey;
  travel: TravelKey;
};

/** O plano salvo: as respostas e os valores finais (o dono pode editar o R$ de cada item). */
export type IndependencePlan = {
  answers: PlanAnswers;
  /** Custo de vida mensal da casa, em R$. */
  livingCost: number;
  /** Pessoas no orçamento: só multiplica a saúde. */
  people: number;
  /** Plano de saúde por pessoa, por mês, em R$. */
  healthPerPerson: number;
  /** Viagens de lazer por ano (da casa), em R$. */
  travelPerYear: number;
  /** Fração dos proventos reinvestida todo mês (0,20 a 0,30). */
  retention: number;
};

export type YieldSource = "carteira" | "padrao";

/** A conta da meta e do prazo (spec §2.2 e §2.3), em reais de hoje. */
export type IndependenceSummary = {
  /** Renda mensal líquida necessária. */
  need: number;
  /** Renda mensal bruta: a necessidade mais a retenção. */
  gross: number;
  /** Yield mensal usado (fração). */
  monthlyYield: number;
  yieldSource: YieldSource;
  /** Patrimônio necessário. */
  target: number;
  patrimony: number;
  /** Patrimônio ÷ meta; pode passar de 1. */
  progress: number;
  /** Aporte médio mensal do bolso (6 meses fechados, menos as vendas). */
  monthlyAporte: number;
  /** Taxa real mensal: yield × (1 − retenção). */
  realRate: number;
  /** Meses até a meta: 0 quando alcançada, null sem prazo nesse ritmo. */
  months: number | null;
  /** AAAA-MM estimado, ou null sem prazo. */
  targetMonth: string | null;
};

/** O DTO da página: o plano (ou null, antes do questionário) e a conta. */
export type IndependenceView = {
  plan: IndependencePlan | null;
  summary: IndependenceSummary | null;
  /** Para o resumo do questionário (calculado no cliente pelas mesmas funções puras). */
  patrimony: number;
  monthlyDividends: number;
  monthlyAporte: number;
  currentMonth: string;
};
