# Carteira Alvo e Recomendações com tabelas iguais para FIIs e ações: especificação de design

> Mudado por `2026-11-01-koinos-3-1-design.md`: três motivos novos em "Fora deste aporte" e na coluna Prioridade (`ABAIXO_DO_MINIMO` e `PROVENTO_SUSPENSO` nos FIIs, `MENOS_DE_UM_LOTE` nas ações).

- **Data:** 2026-10-31
- **Status:** aprovado e implementado (branch feat/tabelas-unificadas)
- **Origem:** pedido do dono: "a tabela de carteira alvo de ações está divergente da de FIIs, ela deve seguir os padrões da de FIIs, com os mesmos campos, colunas. Nas recomendações no modo geral, os papéis devem vir juntos, FIIs e ações, não em tabelas separadas."
- **Muda regras de** `2026-10-31-smart-buy-acoes-design.md`: o viés passa a valer para FIIs, e as % das ações passam a ser reescaladas para 100% (§3).

## 1. Objetivo

- A aba Ações da Carteira Alvo tem as mesmas colunas, campos e painéis da aba FIIs.
- Nas Recomendações, FIIs e ações saem numa tabela só, e os de fora num card só.

### Critérios de sucesso

1. As duas abas da Carteira Alvo mostram as mesmas 12 colunas, na mesma ordem, e a aba Ações tem o painel de ajuste das % e o aviso da soma.
2. Um FII com viés Aguardar não recebe aporte e aparece com o motivo "Viés Aguardar"; sem viés, as ordens de FIIs são as mesmas de antes.
3. As % das ações são reescaladas para 100% como as dos FIIs (a lista que soma 81,5% vale como 100%).
4. A coluna Prioridade das ações mostra a posição na fila do motor de ações (pela margem de segurança) ou o motivo de estar fora.
5. Em Geral, as ordens de FIIs e de ações saem numa tabela só, da maior para a menor, com o selo da classe; os de fora num card só, por motivo.
6. Os testes novos (§6) passam, e os de hoje continuam passando (ajustados onde a regra mudou).

## 2. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Colunas | Iguais nas duas abas: Ativo, Estratégia, Rank, Teto, % sugerida, Categoria, Viés, Preço atual, Margem, Peso/meta, Prioridade, remover | Escolha do dono |
| Viés nos FIIs | Entra, e Aguardar tira o FII da cascata | Escolha do dono |
| Categoria das ações | Sempre "Ação", só leitura | A ação só tem uma categoria (regra da Carteira Alvo de ações) |
| Soma das % das ações | Painel e aviso como nos FIIs; o motor reescala para 100% | Escolha do dono. Substitui "o resto fica em caixa" |
| Tabela das Recomendações | Uma só para FIIs e ações | Escolha do dono |
| Ordem em Geral | Pelo valor da ordem, maior primeiro (empate: ticker) | Escolha do dono |
| Ordem em FIIs e em Ações | A de cada motor (ranking; margem de segurança) | Como antes |

## 3. Regras (código puro)

### 3.1 Viés na cascata de FIIs

- `CascadeAsset.bias?: "COMPRAR" | "AGUARDAR" | null` (opcional: sem ele, nada muda).
- Elegibilidade, na ordem: sem cotação, sem ranking, sem teto, acima do teto, **Aguardar**.
- `ExclusionReason` e o motivo estático da Prioridade ganham `AGUARDAR` ("Viés Aguardar"). O FII fica fora dos dois passos (cascata e sobra), como o que está acima do teto, e o seu valor continua na base da estratégia.

### 3.2 Motor de ações

- `StockBuyAsset.weight` (fração, os pesos da estratégia de ações somam 1) substitui `targetPercent`. A meta é `base × weight`.
- `StockBuyOrder.targetWeight` (fração) substitui `targetPercent`.
- `stockPriorities(assets)`: a Prioridade com aporte zero. Os elegíveis que pedem ao menos uma ação formam a fila, pela margem de segurança (empate: rank, ticker); os outros mostram o motivo (`SEM_COTACAO`, `SEM_TETO`, `ACIMA_DO_TETO`, `AGUARDAR`, `NA_META`, `PEDIDO_PEQUENO`). Devolve o mesmo tipo `AportePriority` da cascata.
- As regras de elegibilidade ficam numa função só, usada por `stockSmartBuy` e por `stockPriorities`.

### 3.3 Snapshot

- A estratégia de ações volta a usar `effectiveWeights` (reescala, quarentena 0%, % vazia divide o resto) e o aviso da soma, como a de FIIs. O alerta "% sugeridas (ações)" volta em Geral.
- `stockBuyInput` é montado dos membros da estratégia de ações (com o peso efetivo), antes das linhas.
- A Prioridade de cada linha vem da cascata (FIIs) ou de `stockPriorities` (ações).
- O viés vai para as linhas das duas classes e para a entrada da cascata de FIIs.

### 3.4 Ordens juntas

- `mergeOrders(fii, stock)` (puro): junta as ordens das duas carteiras numa lista `{ kind: "FII" | "ACAO", order }`, pelo total decrescente e, no empate, pelo ticker.

## 4. Ações do servidor

- `updateTargetAssetAction` deixa de recusar o viés em FIIs.
- O resto fica: a categoria da ação é sempre Ação, a % de uma classe por vez no ajuste.

## 5. Telas

### 5.1 Carteira Alvo

- As duas abas: as 12 colunas de §2; na lista do celular, o resumo, o selo "Aguardar" e a Prioridade nas duas; na folha, Categoria e Viés nas duas (na ação, Categoria "Ação" só leitura).
- O painel de ajuste e o aviso da soma nas duas abas.
- A explicação do card: "Ranking, preço teto, % sugerida e viés pelo ranking. Os campos salvam ao sair. Sem teto, ou com viés Aguardar, o ativo não recebe aporte."

### 5.2 Recomendações

- Um card "Ordens de compra" com uma tabela (e, no celular, uma lista) para as ordens das carteiras da visão:
  - colunas: Ativo (com o selo FII/Ação em Geral), Qtd. ("Cotas" só FIIs, "Ações" só ações), Preço, Total, % antes → depois, % meta, Por quê;
  - em Geral, pelo `mergeOrders`; em FIIs e em Ações, a ordem do motor;
  - a descrição diz a ordem ("Da maior para a menor ordem", "Na ordem do ranking", "Na ordem da margem de segurança");
  - a folha do celular abre o detalhe da ordem conforme a classe.
- Um card "Fora deste aporte" para as duas carteiras, por motivo (os motivos das ações estão contidos nos dos FIIs); o texto de ajuda de cada motivo fala da classe que aparece nele.
- "Copiar ordens" na mesma ordem da tabela, com "cotas" ou "ações" por linha.

## 6. Testes

- `fii-cascade.test.ts`: um FII com Aguardar sai com `AGUARDAR`, não recebe na sobra, e o seu valor fica na base; `aportePriorities` marca `AGUARDAR`; os cenários de hoje não mudam.
- `stock-buy.test.ts`: os casos de hoje com `weight`; `stockPriorities` (fila pela margem, motivos).
- `merge-orders.test.ts` (novo): ordem pelo total, empate pelo ticker, o `kind` de cada linha.
- `snapshot.test.ts`: a estratégia de ações reescala (10 de 81,5 → 0,1227) e tem aviso; o alerta "% sugeridas (ações)" em Geral; `stockBuyInput.weight`; a Prioridade das linhas de ações; o viés dos FIIs na entrada da cascata.
- `explain.test.ts`: o porquê da ação com `targetWeight`.

Verificação: `format:check`, `lint`, `typecheck`, `test` e `build`.

## 7. Documentação

- **CLAUDE.md:** Pages (`/carteira-alvo`, `/recomendacoes`), Asset class (viés nas duas classes), Domain flow item 3 (viés na cascata; ações reescaladas; prioridade das ações; tabela única), Tests.
- **Spec do smart buy de ações:** nota "Mudado por `2026-10-31-tabelas-unificadas-design.md`: viés nos FIIs e % das ações reescaladas".
