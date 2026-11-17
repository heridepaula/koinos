import type { FiscalFlagCode } from "./types";

/**
 * O que cada tipo de achado da auditoria significa e o que o dono deve conferir. Texto fixo,
 * escrito à mão, sem ticker, mês nem valor: aparece uma vez, no primeiro achado de cada tipo.
 */
export const FINDING_NOTES: Record<FiscalFlagCode, string> = {
  CNPJ_AUSENTE:
    "O CNPJ do emissor é obrigatório na ficha Bens e Direitos e no agrupamento dos proventos. Informe-o na aba Bens e Direitos.",
  PRECO_ESTIMADO:
    "Esta compra não tem nota de negociação, então o custo de aquisição do ativo é uma estimativa. Confira com a nota de corretagem, se a tiver.",
  POSICAO_ANTERIOR:
    "A posição já existia antes do primeiro extrato da bolsa, sem data nem preço de compra conhecidos. Confira o custo com a declaração do ano anterior.",
  SALDO_PREJUIZO_NAO_INFORMADO:
    "Sem o saldo de prejuízo acumulado de períodos anteriores, a compensação na apuração pode estar errada. Informe o saldo na aba Vendas e apuração; zero também vale.",
  PROVENTO_REEMBOLSO:
    "Reembolso de provento, como o de empréstimo de ativos, não tem ficha própria e ficou fora das fichas. Confira com o informe de rendimentos onde declará-lo.",
  PROVENTO_NAO_CLASSIFICADO:
    "O programa não conseguiu enquadrar este provento em nenhuma ficha da declaração. Confira o tipo no extrato da bolsa e no informe de rendimentos.",
  ALUGUEL_NAO_CLASSIFICADO:
    "O rendimento de aluguel (empréstimo) de ativos não foi enquadrado em nenhuma ficha. Confira com a corretora como ele deve ser declarado.",
  RETENCAO_DIVIDENDO_POSSIVEL:
    "Os dividendos desta fonte pagadora passaram do limite mensal da regra de retenção na fonte. Confira o valor retido no informe de rendimentos.",
  JCP_FORA_DA_FAIXA:
    "O valor líquido deste juro sobre capital próprio não corresponde à retenção esperada. Confira com o informe de rendimentos da fonte pagadora.",
  DAY_TRADE_NAO_APURADO:
    "Compra e venda do mesmo ativo no mesmo dia é day trade, que o Koinos ainda não apura. Apure esse imposto à parte, pois ele pode afetar o swing trade do mês.",
  VENDA_ACIMA_ISENCAO:
    "As vendas de ações no mês passaram do limite de isenção, então o lucro do mês é tributável e gera DARF. Confira a apuração do mês e o prazo de pagamento.",
};
