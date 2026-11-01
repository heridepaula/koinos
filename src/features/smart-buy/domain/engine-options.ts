/**
 * Opções do motor de aporte (spec koinos-3-1, §3): cada regra do conselho é uma chave, e uma versão
 * nomeada liga as aprovadas. Sem opções, os motores rodam a 3.0 (o comportamento de antes).
 */
export type EngineOptions = {
  /** FIIs: nenhuma ordem abaixo da fatia justa (aporte ÷ nº de FIIs da estratégia). */
  minOrder: "none" | "fairShare";
  /** FIIs: provento suspenso tira o FII do aporte. */
  suspensionBrake: boolean;
  /** Ações: tamanho do lote (1 ou 100, o lote padrão da B3). */
  stockLot: 1 | 100;
  /** Ações: passo de sobra por lote. */
  stockLeftover: boolean;
};

export const ENGINE_VERSIONS = {
  "3.0": { minOrder: "none", suspensionBrake: false, stockLot: 1, stockLeftover: false },
  "3.1": { minOrder: "fairShare", suspensionBrake: true, stockLot: 100, stockLeftover: true },
} as const satisfies Record<string, EngineOptions>;

export type EngineVersion = keyof typeof ENGINE_VERSIONS;

/** A versão que a tela de Recomendações e a coluna Prioridade usam. */
export const CURRENT_ENGINE: EngineVersion = "3.1";
