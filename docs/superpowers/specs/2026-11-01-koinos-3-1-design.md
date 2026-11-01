# Koinos 3.1: motor com opções, notas das lentes e as regras sem conflito: especificação de design

- **Data:** 2026-11-01
- **Status:** aprovado e implementado (branch feat/koinos-3-1)
- **Origem:** os relatórios da skill `conselho-investidores` (cascata de FIIs, smart buy de ações, tensor de DY) e a análise do mínimo de compra de 2026-10-31. O dono pediu: "Como transformar esses outputs em algoritmo de recomendação?", e acrescentou: "evite compras pequenas, encontre um número mágico para definir o mínimo" e "o lote mínimo para ações é 100".
- **Muda regras de:**
  - `2026-10-30-koinos-3-0-design.md`: mínimo por ordem, freio de suspensão e janela de 12 meses dos proventos;
  - `2026-10-31-smart-buy-acoes-design.md`: lote de 100 e passo de sobra, que substitui "sem passo de sobra";
  - `2026-10-31-tabelas-unificadas-design.md`: três motivos novos em "Fora deste aporte" e na coluna Prioridade.

## 1. Objetivo

- As recomendações do conselho entram nos motores como opções, com o padrão igual ao de hoje.
- Uma versão nomeada (Koinos 3.1) liga as regras aprovadas.
- As lentes viram notas calculadas por código, e o laboratório compara versões com elas.
- A 3.1 traz as regras que não contrariam decisões anteriores do dono, mais as duas que ele pediu:
  - mínimo por ordem nos FIIs;
  - freio de suspensão nos FIIs;
  - lote de 100 com passo de sobra nas ações;
  - janela de 12 meses de calendário nos proventos.

### Critérios de sucesso

1. Sem opções, ou com a 3.0, os motores dão exatamente o resultado de hoje. Os 158 testes atuais passam sem mudança.
2. Com a 3.1, as regras do §4 valem, e cada uma tem os testes do §8.
3. Antes do merge, `comparar --a 3.0 --b 3.1` roda na carteira real e é mostrado ao dono. Pelas simulações do apêndice, a direção esperada é:
   - menos ordens de FIIs;
   - nenhuma ordem de FII abaixo do mínimo;
   - sobra pequena nos FIIs;
   - desvio da meta dos FIIs no máximo 0,2 p.p. pior;
   - 90% ou mais da parte das ações investida;
   - nenhuma compra fora do método.
4. `format:check`, `lint`, `typecheck`, `test` e `build` passam.

## 2. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Como as recomendações entram | Opções do motor real, desligadas na 3.0; versões nomeadas em código | Escolha do dono. Avaliar uma regra deixa de exigir uma cópia do motor |
| Regras na tela | Não há chaves na tela; a tela usa a versão atual | Escolha do dono (a abordagem "regras ligáveis" ficou de fora) |
| Troca para a 3.1 | Comparação mostrada no chat antes do merge; a tela troca no merge | Escolha do dono |
| Mínimo por ordem | Fatia justa: aporte ÷ nº de ativos da estratégia, no máximo metade da trava por ativo | Simulação: corta as ordens pequenas sem custo até 10% do aporte |
| Mínimo nas ações | Substituído pelo lote | Um lote de 100 já custa mais que a fatia justa (R$ 250 hoje) |
| Lote das ações | 100, o lote padrão da B3; FIIs continuam em cotas | Pedido do dono, para não comprar no fracionário |
| Sobra das ações | Passo de sobra por lote; o resto menor que um lote fica em caixa | Escolha do dono. Sem ele, só 11% a 32% iria para as ações |
| Freio de suspensão | Só FIIs | Ações pagam a cada 3, 6 ou 12 meses, e o motor de ações não olha proventos, por decisão do dono |
| 12 meses de calendário | Correção do dado de entrada, para as duas versões | A soma atual pega 11 ou 13 pagamentos conforme o dia do mês |
| Aviso de caixa parado | Fica de fora | Escolha do dono |
| IPCA e Selic (SGS do Banco Central) | Spec própria, logo depois desta | Escolha do dono |

## 3. Versões e opções (código puro)

Novo arquivo `src/features/smart-buy/domain/engine-options.ts`:

```ts
export type EngineOptions = {
  /** FIIs: nenhuma ordem abaixo da fatia justa (§4.1). */
  minOrder: "none" | "fairShare";
  /** FIIs: provento suspenso tira o FII do aporte (§4.2). */
  suspensionBrake: boolean;
  /** Ações: tamanho do lote (§4.3). */
  stockLot: 1 | 100;
  /** Ações: passo de sobra por lote (§4.4). */
  stockLeftover: boolean;
};

export const ENGINE_VERSIONS = {
  "3.0": { minOrder: "none", suspensionBrake: false, stockLot: 1, stockLeftover: false },
  "3.1": { minOrder: "fairShare", suspensionBrake: true, stockLot: 100, stockLeftover: true },
} as const satisfies Record<string, EngineOptions>;

export type EngineVersion = keyof typeof ENGINE_VERSIONS;
export const CURRENT_ENGINE: EngineVersion = "3.1";
```

- **Opções como último parâmetro:**
  - `sunoCascade(amount, assets, options = ENGINE_VERSIONS["3.0"])`;
  - `aportePriorities(assets, options)`;
  - `stockSmartBuy(amount, assets, options)`;
  - `stockPriorities(assets, options)`.

  O padrão é a 3.0, então os testes e os chamadores de hoje não mudam.
- **Quem passa a versão atual:** o app passa `ENGINE_VERSIONS[CURRENT_ENGINE]` em `AporteCalculator` e no snapshot, que monta a coluna Prioridade.
- **Exportação:** `index.ts` da feature passa a exportar `EngineOptions`, `ENGINE_VERSIONS`, `EngineVersion` e `CURRENT_ENGINE`.
- **Regra futura:** é uma chave nova em `EngineOptions` e uma versão nova em `ENGINE_VERSIONS`.

## 4. Regras

### 4.1 Mínimo por ordem nos FIIs (`minOrder: "fairShare"`)

- **Valor:** `mínimo = round2(min(aporte ÷ nº de FIIs da estratégia, 12,5% do aporte))`.
  - O número de FIIs é o tamanho da entrada da cascata, contando os que estão fora deste aporte por teto, Aguardar ou suspensão.
  - 12,5% é metade da trava por FII. Com o mínimo perto da trava, quase nenhuma ordem caberia; com 25%, nenhuma.
  - Sem FIIs, ou com aporte zero, o mínimo é zero e nada muda.
- **Passo 1:** a ordem calculada como hoje (cotas inteiras do menor entre pedido, travas e saldo) que valer menos que o mínimo não sai. O dinheiro segue para o próximo da fila.
- **Passo 2 (sobra):**
  - um FII que já tem ordem recebe uma cota por vez, como hoje;
  - um FII sem ordem só entra comprando ⌈mínimo ÷ preço⌉ cotas de uma vez, dentro das travas e do saldo;
  - a escolha continua sendo a menor razão (valor + comprado) ÷ meta da sobra, com empate para o melhor ranking.
- **Motivo de quem fica sem ordem:**
  - `ABAIXO_DO_MINIMO` ("Abaixo do mínimo") quando o próprio pedido, em cotas inteiras, vale menos que o mínimo;
  - quando foi a trava ou o saldo que cortou abaixo do mínimo, vale o motivo de hoje (`LIMITE_ATIVO`, `LIMITE_SETOR`, `LIMITE_MACRO` ou `SEM_SALDO`);
  - a ordem de checagem é `NA_META`, `PEDIDO_PEQUENO`, `ABAIXO_DO_MINIMO` e, por fim, os motivos das travas e do saldo.
- **Resultado:** `CascadeResult` ganha `minimum: number`, para a tela mostrar.
- **Prioridade:** `aportePriorities` usa aporte zero, então o mínimo é zero e a coluna não muda.
- **Hoje:** R$ 10.000 ÷ 17 = R$ 588, ou de 6 a 10 cotas por FII (72 no GARE11).

### 4.2 Freio de suspensão nos FIIs (`suspensionBrake`)

- **Entrada:** `CascadeAsset` ganha dois campos opcionais. Sem eles, nada muda.
  - `daysSinceLastDividend: number | null`;
  - `dividendPayments12m: number | null`.
- **Elegibilidade:** uma nova regra, depois de `AGUARDAR`: `PROVENTO_SUSPENSO` ("Provento suspenso"). O FII suspenso fica fora dos dois passos, e o valor dele continua na base, como acontece com teto e Aguardar.
- **Quando suspende:** com `daysSinceLastDividend` não nulo, em qualquer destes casos:
  - mais de 45 dias e 6 ou mais pagamentos na janela do §5, ou seja, um pagador regular que parou;
  - mais de 365 dias, ou seja, há pagamento conhecido, mas nenhum há um ano.
- **Quando não suspende:**
  - sem nenhum pagamento conhecido, o campo é nulo e o FII fica neutro, como hoje;
  - um FII que paga a cada 3 ou 6 meses (menos de 6 pagamentos) não é suspenso pela regra dos 45 dias.
- **Cálculo no snapshot:** `daysSinceLastDividend = floor((agora − data ex do último provento) ÷ 1 dia)`.
  - Vale só se o último provento existe e os proventos foram atualizados há no máximo 10 dias (`dividendsFetchedAt`). Senão, o campo é nulo.
  - Assim, uma falha do Yahoo não suspende ninguém.
  - O cron diário atualiza todos os ativos da Carteira Alvo, não só os que estão na carteira.
- **Tipos e rótulos:** `EligibilityReason`, `ExclusionReason` e `PriorityReason` ganham `PROVENTO_SUSPENSO`, com rótulo em `EXCLUSION_LABELS`.
- **Ações:** não entram.

### 4.3 Lote de 100 nas ações (`stockLot: 100`)

- **Lote:** toda ordem de ação é múltiplo de `stockLot`.
- **Passo 1:** na ordem de hoje (margem de segurança, depois rank e ticker), cada ação compra `min(⌊déficit ÷ (lote × preço)⌋, ⌊caixa ÷ (lote × preço)⌋)` lotes.
- **Déficit menor que um lote:**
  - com lote 100, o motivo é `MENOS_DE_UM_LOTE` ("Menos de 1 lote");
  - com lote 1, continua `PEDIDO_PEQUENO`, como hoje.
- **Sem caixa:** a ação elegível com déficit de ao menos um lote e sem caixa fica `SEM_SALDO`.
- **Prioridade:** `stockPriorities` usa a mesma classificação, com aporte zero. Na fila entram as ações cujo déficit chega a um lote; as outras mostram `MENOS_DE_UM_LOTE`.
- **Mínimo:** o mínimo por ordem (§4.1) não vale nas ações.

### 4.4 Sobra por lote nas ações (`stockLeftover`)

- **Como funciona:** depois do passo 1, um lote por vez vai para a ação elegível com a menor razão (valor + comprado × preço) ÷ (base × peso), entre as que cabem no caixa.
  - Elegível: com cotação, com teto, preço ≤ teto, sem Aguardar e peso > 0.
  - Empate: o melhor rank, depois o ticker.
  - O ciclo para quando nenhum lote cabe.
  - Nenhuma ação passa de 25% da parte das ações do aporte pela sobra (decisão do dono, 2026-11-01).
- **Meta:** pode passar da meta, como na sobra dos FIIs. A ação que estava `NA_META` ou `MENOS_DE_UM_LOTE` no passo 1 também pode receber, se for a mais abaixo.
- **Resultado:**
  - `StockBuyOrder` ganha `fromLeftover: number`, as ações vindas da sobra;
  - a ação que só recebeu na sobra vira ordem;
  - as que ficaram sem nada mantêm o motivo do passo 1;
  - o `leftover` é o caixa final, menor que o lote mais barato entre as elegíveis que ainda cabem nos 25%.
- **Por que agora:** a parte das ações já ficava parada sem o lote (55% investido com R$ 3 mil por mês, por causa das ações em Aguardar e das que passaram da meta). Com o lote e sem sobra, iria a 11% a 32%.

## 5. Dados: 12 meses de calendário

- **Função pura** em `src/features/market-data/domain/dividend-window.ts`: `dividendWindow(dividends, now)` recebe os proventos (data ex e valor por cota) e devolve `{ total, payments, last }`.
  - `last` é o provento de data ex mais recente, ou nulo.
  - **Janela:** os 12 meses de calendário que terminam no mês da data ex de `last`, com as datas já normalizadas como data de negócio. Um pagador mensal soma 12 pagamentos, sem 11 ou 13 conforme o dia do mês.
  - Se `last` tem mais de 365 dias, `total` e `payments` são zero.
- **`refreshDividends`:**
  - busca 760 dias no Yahoo em vez de 400, para que a janela de um FII parado há até 12 meses caiba;
  - grava `dividends12m = total`, `dividendPayments12m = payments` (campo novo no modelo `Asset`) e `dy12m = total ÷ preço`;
  - grava `lastDividend = last` quando há provento;
  - **último provento fixo:** quando a busca dá certo e não traz nenhum provento, o `lastDividend` gravado fica, e não vira nulo;
  - quando a busca falha, nada é gravado, como hoje;
  - `dividendAnnouncements` (90 dias) não muda.
- **Leitura:** `AssetSnapshot` e `PriceInfo` ganham `dividendPayments12m` e `dividendsFetchedAt`, e o snapshot os leva para a entrada da cascata (§4.2).
- **Migração:** não há. O cron diário recalcula tudo no dia útil seguinte ao deploy.
- **Efeito nas duas versões:** o freio de proventos e o DY da tela passam a usar a soma corrigida. A comparação 3.0 × 3.1 usa o mesmo dado.

## 6. Notas das lentes e laboratório

### 6.1 Simulação e notas (código puro, com testes)

- **`simulation.ts`:** `simulateAportes(input, params)` roda os dois motores reais com as opções de uma versão por N aportes.
  - `input`: a entrada da cascata e a das ações.
  - `params`: valor, % dos FIIs, períodos, opções e um gerador de preços opcional.
  - Cada período executa as ordens e soma as quantidades.
  - **Preços:** parados ou sorteados com semente (fator comum + próprio, log-normal, com o P/VP andando junto).
- **`scorecard.ts`:** `scorecard(runs)` devolve as notas, com as médias sobre os cenários quando há sorteio.

| Lente | Nota |
| --- | --- |
| Tiago Reis | % do aporte investido (por carteira e no total) |
| Tiago Reis | estabilidade: fração do primeiro aporte que troca de ativo com ruído de 1% nos preços, isto é, ½ Σ \|total com ruído − total sem ruído\| ÷ aporte, média de 100 cenários |
| Tiago Reis | compras fora do método: ordens acima do teto, com Aguardar ou de FII suspenso. Precisa dar zero |
| Baroni | desvio da meta dos FIIs no fim (½ Σ \|peso − meta\|) e a média por período |
| Baroni | FIIs que receberam ao menos uma ordem |
| Baroni | tijolo e papel: % do valor da estratégia contra a soma das metas de cada macro |
| Baroni | ordens de FII por período e a menor ordem |
| Buffett | rank médio ponderado pelo dinheiro, por classe (ativo sem rank fica fora da média) |
| Buffett | % do dinheiro dos FIIs que foi para FII com freio de proventos ou de vacância abaixo de 1 |
| Barsi | caixa parado nas ações (média por período, em R$ e em % da parte das ações) |
| Barsi | ordens e lotes de ações por período |

As notas de renda real e de DY contra a inflação ficam para a spec do SGS.

### 6.2 Laboratório da skill

- **Comando novo:** `comparar --a 3.0 --b 3.1 [--valor 10000] [--periodos 12] [--fiis 100] [--cenarios 300] [--semente 20261031]`. Mostra:
  - o primeiro aporte das duas versões lado a lado: ordens e quem ficou de fora, com o motivo;
  - a tabela de notas A × B, com preços parados e com preços sorteados.
- **Comandos atuais:** `recomendar`, `projetar`, `choque` e `mes` ganham `--versao`, que por padrão é `CURRENT_ENGINE`.
- **Referências da skill:**
  - `formulas.md` registra as opções, as versões, as regras novas e as decisões novas do dono;
  - `SKILL.md` orienta a comparar versões e opções com `comparar`. Só uma proposta que ainda não é opção pede um script descartável.

## 7. Telas

- **Recomendações:**
  - `AporteCalculator` usa `ENGINE_VERSIONS[CURRENT_ENGINE]`.
  - A descrição do card "Ordens de compra" acrescenta a regra da visão: "Nenhuma ordem de FII abaixo de R$ 588 (aporte ÷ 17 FIIs)" quando há parte em FIIs, e "Ações em lotes de 100" quando há parte em ações.
  - "Fora deste aporte" ganha os três motivos, com o texto de ajuda de `reasonHelp`:
    - **Abaixo do mínimo (FIIs):** "O pedido não chegava ao mínimo por ordem (aporte ÷ nº de FIIs da estratégia). O dinheiro foi para os próximos da fila; no próximo aporte o pedido cresce."
    - **Provento suspenso (FIIs):** "Pagava com regularidade e está há mais de 45 dias sem data ex, ou há mais de um ano sem pagar. Fica fora do aporte até voltar a pagar."
    - **Menos de 1 lote (ações):** "O que faltava para a meta não chegava a um lote de 100 ações. Pode receber pela sobra, se for a mais abaixo da meta."
  - O "Por quê" de uma ação com `fromLeftover > 0` diz "N lote(s) pela sobra", como o dos FIIs já diz as cotas da sobra.
  - `PRINCIPLES` ganha "Sem ordens pequenas: mínimo nos FIIs, lote de 100 nas ações", e o aviso termina com o rótulo discreto "Koinos 3.1".
- **Carteira Alvo:** a coluna Prioridade mostra os rótulos novos (`priority-badge.tsx` já lê `EXCLUSION_LABELS`).
- **Copiar ordens:** não muda. As ações já saem em "ações", agora em múltiplos de 100.

## 8. Testes

- **Compatibilidade:**
  - os 158 testes atuais passam sem mudança;
  - um teste novo roda as 500 carteiras aleatórias da invariante da cascata e confere que, sem opções e com `ENGINE_VERSIONS["3.0"]`, o resultado é idêntico;
  - o mesmo vale para `stockSmartBuy` em carteiras aleatórias.
- **Mínimo (`suno-cascade.test.ts`):**
  - com a 3.1 nas 500 carteiras, nenhuma ordem abaixo do mínimo e gasto + sobra = aporte;
  - o dinheiro de um FII pulado vai para o próximo da fila;
  - a sobra completa uma ordem existente com 1 cota e só abre ordem nova no mínimo;
  - `ABAIXO_DO_MINIMO` contra o motivo da trava ou do saldo;
  - o limite de 12,5% com poucos FIIs;
  - com aporte zero, o mínimo é zero.
- **Suspensão:**
  - pagador regular com 46 dias sai com `PROVENTO_SUSPENSO`;
  - com 44 dias, não sai;
  - com 5 pagamentos e 60 dias, não sai;
  - com 366 dias, sai mesmo com poucos pagamentos;
  - sem histórico, neutro;
  - o valor do suspenso fica na base;
  - `aportePriorities` marca `PROVENTO_SUSPENSO`.
- **Snapshot:**
  - `daysSinceLastDividend` é nulo com proventos atualizados há mais de 10 dias;
  - os campos chegam à entrada da cascata;
  - a Prioridade das linhas usa a versão atual.
- **Janela (`dividend-window.test.ts`):**
  - 13 datas ex em 365 dias somam 12;
  - um mês sem pagamento soma 11;
  - último pagamento com 400 dias dá zero;
  - dois pagamentos no mesmo mês entram os dois;
  - a contagem `payments`;
  - a normalização da data de negócio.
- **Último provento fixo:** um teste da regra que decide o que gravar, extraída para uma função pura.
- **Lote e sobra (`stock-buy.test.ts`):**
  - só múltiplos de 100;
  - `MENOS_DE_UM_LOTE`;
  - a sobra vai para a menor razão valor ÷ meta e pode passar da meta;
  - o caixa final é menor que o lote mais barato entre as elegíveis;
  - nada acima do teto nem com Aguardar;
  - gasto + sobra = aporte;
  - `stockPriorities` com lote;
  - `fromLeftover`.
- **Notas (`scorecard.test.ts`):** sequências pequenas com resultado conhecido para cada nota, incluindo a estabilidade com semente fixa.
- **Textos (`explain.test.ts`):** os três textos de ajuda e o "N lote(s) pela sobra".
- **Verificação:** `format:check`, `lint`, `typecheck`, `test` e `build`.

## 9. Documentação

- **CLAUDE.md:**
  - **Domain flow, item 3:** versões e opções, as regras da 3.1, o lote e a sobra das ações.
  - **Market data:** 760 dias, a janela de calendário, `dividendPayments12m` e o último provento fixo.
  - **Product rules:** Koinos 3.1, com o lote de 100 e a sobra por lote substituindo "sem passo de sobra".
  - **Tests:** a lista atualizada.
- **Specs anteriores:** uma nota "Mudado por `2026-11-01-koinos-3-1-design.md`" nas três da origem.
- **Skill:** as referências do §6.2.

## 10. Troca e verificação final

1. A branch `feat/koinos-3-1` implementa tudo, com `CURRENT_ENGINE = "3.1"`.
2. Antes do merge, rodo `comparar --a 3.0 --b 3.1` na carteira real, só leitura, e mostro no chat:
   - o primeiro aporte das duas versões;
   - a tabela de notas;
   - a comparação com a direção esperada do §1, item 3.
3. Com o ok do dono, faço o fast-forward da `main` e o push, que publica a versão.

## 11. Fora do escopo

- **Etapa 3, cada regra com as notas e a decisão do dono:**
  - trava de macro pela meta do tijolo;
  - freio de proventos nas ações;
  - aceleradores relativos à média;
  - rank primeiro nas ações;
  - mediana no freio de proventos;
  - Prioridade com aporte de referência;
  - valuation na meta da sobra.
- **Dados novos:** IPCA, Selic e CDI pelo SGS (próxima spec), setor das ações e data de atualização do teto.
- **Sem código:**
  - o tensor de DY, que o conselho rejeitou;
  - o aviso de caixa parado, que o dono recusou;
  - a decisão sobre os três FIIs SN fora da estratégia e a divisão padrão FIIs/ações.

## Apêndice: números das simulações (carteira real, 2026-10-31, só leitura)

**Mínimo por ordem nos FIIs:** R$ 10.000 por mês, 12 aportes. A cópia do motor com mínimo zero bateu com o real em 501 de 501 casos.

| Mínimo | Ordens/mês (parado / 300 trajetórias) | Menor ordem | Sobra média | Desvio da meta (parado / sorteado) |
| --- | --- | --- | --- | --- |
| Nenhum | 15,3 / 9,3 | R$ 61 / R$ 6 | R$ 17 / R$ 24 | 1,5% / 2,9% |
| Fatia justa (R$ 588) | 9,1 / 6,7 | R$ 594 / R$ 588 | R$ 20 / R$ 33 | 1,5% / 2,9% |
| R$ 1.000 | 6,9 / 5,5 | R$ 1.003 / R$ 1.000 | R$ 24 / R$ 40 | 1,6% / 2,9% |
| 2× a fatia (R$ 1.176) | 5,7 / 5,1 | R$ 1.187 / R$ 1.176 | R$ 33 / R$ 48 | 2,1% / 3,2% |

Se a sobra só pudesse completar ordens existentes, ficariam até R$ 4 mil parados em 5% dos meses. Por isso a sobra pode abrir ordem nova no mínimo (§4.1).

**Lote nas ações:** 12 aportes, preços parados, Carteira Alvo de hoje (33,7% do peso em Aguardar).

| Variante | Investido (R$ 3 mil / R$ 10 mil) | Desvio entre as compráveis | Ordens/mês |
| --- | --- | --- | --- |
| Hoje (1 ação, sem sobra) | 55% / 25% | 6,9% / 4,0% | 4,9 / 6,2 |
| Lote de 100, sem sobra (lote mais próximo) | 32% / 20% | não medido (desvio total: 25,3% / 16,7%) | 0,7 / 0,9 |
| Lote de 100 + sobra por lote | 91% / 97% | 24,2% / 3,3% | 1,8 / 3,8 |

- **Lote maior que a meta:** com R$ 22,5 mil em 12 ações, vários lotes custam mais que a meta da ação: TUPY3 (lote R$ 1.446, meta R$ 1.252), UNIP6 (R$ 5.100 × R$ 3.143) e VALE3 (R$ 6.202 × R$ 3.143).
- **Aporte junto rende mais:** com lote, juntar o dinheiro das ações rende mais. R$ 10 mil de uma vez deram desvio de 3,3%, contra 24,2% com R$ 3 mil por mês.
