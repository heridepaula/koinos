# Carteira Alvo de ações: especificação de design

- **Data:** 2026-10-31
- **Status:** aprovado, a implementar (branch feat/carteira-alvo-acoes)
- **Origem:** Fase 2 do plano colado pelo dono em 2026-10-31 ("várias carteiras de recomendação"). O dono escolheu uma carteira por classe, sem CRUD de carteiras (§2).
- **Muda uma regra de 2026-10-30:** "ação nunca entra na estratégia" (spec `2026-10-30-acoes-etapa-1-design.md`) passa a ser "a ação tem a sua própria Carteira Alvo, fora das Recomendações".

## 1. Objetivo

Ter uma Carteira Alvo de ações ao lado da de FIIs, cada uma com os seus 100%: rank, preço teto, % sugerida, quarentena e os alertas da estratégia. As Recomendações continuam só com FIIs; o aporte em várias carteiras é a Fase 3, com spec própria.

### Critérios de sucesso

1. `/carteira-alvo?classe=acoes` lista as ações em carteira ou configuradas, e dá para adicionar, editar e remover ações.
2. A soma das % de cada carteira fecha 100% sozinha, e o painel de ajuste trata cada carteira à parte.
3. Adicionar uma ação na aba FIIs (ou um FII na aba Ações) é recusado com a mensagem certa.
4. As Recomendações dão as mesmas ordens de antes para o mesmo aporte, com ações configuradas.
5. Em Geral, uma ação da carteira de ações não aparece como "fora da estratégia" na tabela de posições.
6. Os testes novos (§8) passam, e os de hoje continuam passando.

## 2. O que mudou em relação ao plano de origem

| Plano de origem | Decisão | Motivo |
| --- | --- | --- |
| Coleção `PortfolioStrategy` com nome e tipo, `portfolioStrategyId` nos alvos, migração | Uma carteira por classe, derivada da classe do ticker. Nada novo no banco | Escolha do dono: duas carteiras fixas bastam. Sem migração em produção |
| `createStrategy`, `updateStrategyName`, `deleteStrategy` | Não existem | Sem carteiras com nome |
| Lista de carteiras na lateral, `?strategyId=` | Seletor FIIs \| Ações em `?classe=` | O mesmo padrão das telas por classe (etapa 2) |
| Validação dos 100% por carteira | Mantida | — |

## 3. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Quantas carteiras | Uma por classe: FIIs e Ações | Escolha do dono |
| Uso antes da Fase 3 | Só acompanhar: tabela, painel dos 100% e alertas. Recomendações só de FIIs | Escolha do dono |
| Modelo | Abordagem A: a classe do ticker define a carteira | Escolha do dono. Se um dia houver carteiras com nome, entra uma coleção nova |
| Campos da ação | Os mesmos do FII (rank, teto, %, na estratégia, quarentena 0%). A categoria é sempre "Ação" | O método Suno usa rank e teto também em ações |

## 4. Regras (código puro)

### 4.1 Estratégia por classe

- `buildSnapshot` monta a estratégia de cada classe com a mesma função: os membros (`inStrategy` da classe), os pesos efetivos (`effectiveWeights`, que fecham 100% dentro da classe), o valor da estratégia, as linhas da Carteira Alvo e o aviso das %.
- A classe vem do mesmo `classOf` do snapshot: `ACAO` é ação, o resto (incluindo classe desconhecida) é FII.
- `snapshot.strategy` é a estratégia da visão: a de Ações quando a visão é Ações; a de FIIs em Geral e em FIIs. A Carteira Alvo de FIIs e as Recomendações leem o mesmo campo de hoje.
- A cascata (`cascadeInput`) e a prioridade de aporte (`aportePriorities`) continuam só com os FIIs. Na ação, `priority` é null.
- Na tabela de posições, `inStrategy`, `strategyWeight` e `targetWeight` vêm da estratégia da classe do ativo. Rank, teto e margem aparecem para ações configuradas.
- `scopeToClass`: na visão Ações, passa os alvos de ações (não mais uma lista vazia). Na visão FIIs, os alvos de FIIs. O `withAlerts` da etapa 2 sai.

### 4.2 Alertas

`buildAlerts` se divide em dois grupos:

- **Da carteira**, sobre as posições da visão: concentração e "sem cotação".
- **Da estratégia**, uma vez por classe: teto suspeito, estratégia incompleta, ranking repetido, % sugeridas e "fora da Carteira Alvo".
  - Em Geral, saem os das duas classes. Os de ações levam " (ações)" no título e `-acoes` no `id`.
  - Na visão FIIs, só os de FIIs; na visão Ações, só os de ações, sem o sufixo.
  - O texto de "estratégia incompleta" na ação diz que fica sem rank ou teto, sem falar de aporte: "sem ranking ou sem preço teto".

## 5. Tela

### 5.1 `/carteira-alvo`

- Seletor FIIs | Ações em `?classe=` (`fiis` é o padrão; não há Geral, porque cada carteira tem os seus 100%). Reaproveita o `AssetClassControl` com a prop `includeAll={false}`: sem a opção Geral, e sem `?classe=` mostra FIIs.
- A página lê a classe dentro da `<Suspense>` e chama `getPortfolioSnapshot("ACAO")` ou `getPortfolioSnapshot("FII")`. `?classe=` ausente ou desconhecido é FIIs.
- **Aba Ações:**
  - a tabela esconde a coluna de categoria e a de prioridade de aporte;
  - o painel dos 100% (`suggestPercentFix`) funciona igual, só com as ações;
  - uma linha curta abaixo do título: "As Recomendações ainda são só de FIIs."
- O formulário de adicionar manda a classe da aba.

### 5.2 Dashboard

- Na visão Ações, os alertas de estratégia de ações aparecem.
- Em Geral, os das duas classes (§4.2).

### 5.3 Recomendações

Sem mudança.

## 6. Ações do servidor (`strategy/actions.ts`)

- `refuseStock` sai.
- `addTargetAssetAction`: o input ganha `assetClass: "FII" | "ACAO"`. A classe do ticker vem do catálogo (`getAssetClasses`). Se não bate, `ActionError`:
  - "PETR4 é ação: adicione na aba Ações.";
  - "HGLG11 não é ação: adicione na aba FIIs.".
  - A ação nasce na estratégia com a categoria "Ação".
- `updateTargetAssetAction`: numa ação, a única categoria aceita é "Ação" (`ActionError` "A categoria de uma ação é sempre Ação.").
- `setSuggestedPercentsAction`: todos os itens precisam ser da mesma classe (`ActionError` "As % de FIIs e de ações ficam em carteiras separadas.").
- `traceInput` de `addTargetAsset` continua só `ticker`; `assetClass` não entra (não está em `TRACEABLE_INPUT_FIELDS`, e não precisa).

## 7. Erros e limites

- Unit fora do catálogo continua lida como FII (limite da etapa 1, §4): cai na aba FIIs.
- Uma ação que já tem configuração antiga de outra categoria (não deve existir: a etapa 1 recusava) é mostrada como "Ação".

## 8. Testes

Vitest, só no código puro:

- `portfolio/domain/snapshot.test.ts`:
  - com alvos de FIIs e de ações, cada estratégia soma 100% sozinha (`targetWeight` dos membros da classe);
  - a `cascadeInput` só tem FIIs, e `sunoCascade` dá as mesmas ordens com e sem os alvos de ações;
  - em Geral, a ação configurada sai com `inStrategy` true na tabela de posições e `priority` null;
  - na visão Ações, `strategy.rows` são as ações.
- `portfolio/domain/alerts.test.ts` (novo): em Geral, "fora da Carteira Alvo" das ações sai com " (ações)" e id `sem-configuracao-acoes`; na visão FIIs, nenhum alerta de ações.
- `strategy/domain`: os testes de pesos e quarentena valem para qualquer classe (sem mudança).

Verificação: `format:check`, `lint`, `typecheck`, `test` e `build`. Depois, um script só de leitura com os dados reais confere que as ordens das Recomendações para R$ 10.000 são iguais às da `main`.

## 9. Documentação

- **CLAUDE.md:** Asset class ("Stocks never enter the strategy" → a carteira de ações, fora das Recomendações), Pages (`/carteira-alvo?classe=`), Domain flow item 2 e 3 (estratégia por classe, alertas), Product rules (Stocks).
- **Spec da etapa 1:** nota apontando para este spec na regra da estratégia.

## 10. Fora do escopo

- Carteiras com nome, CRUD de carteiras, o mesmo ticker em duas carteiras.
- Recomendações de ações e o aporte dividido entre carteiras (Fase 3).
- Setor das ações e riscos por setor para ações.
