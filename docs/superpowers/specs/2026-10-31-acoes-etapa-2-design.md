# Ações na carteira, etapa 2 (telas por classe): especificação de design

- **Data:** 2026-10-31
- **Status:** aprovado, a implementar (branch feat/acoes-etapa-2)
- **Origem:** pedido do usuário com um plano em três fases: filtro Ações/FIIs/Ambos, várias Carteiras Alvo e aporte em várias carteiras. O dono escolheu fazer só a primeira fase, que é a etapa 2 prevista no spec `2026-10-30-acoes-etapa-1-design.md` (§12). As diferenças entre o plano e o código estão no §2.
- **Ciclo:** etapa 2 de 2. A etapa 1 trouxe as ações para os dados e as contas; esta separa as telas por classe.

## 1. Objetivo

Ver a carteira em três visões: Geral, FIIs e Ações. O filtro vale no Dashboard, em Proventos, em Encerradas e IR, no Reinvestimento e em Transações. Proventos também ganha o filtro por tipo e a soma por tipo. A Carteira Alvo e as Recomendações não mudam: continuam só com FIIs.

### Critérios de sucesso

Com os dados de produção de 31/10/2026:

1. **Soma:** em cada página, FIIs + Ações = Geral, no patrimônio, no investido, nos proventos recebidos, no resultado das encerradas, no IR estimado e no aporte e no "de proventos" do Reinvestimento.
2. **% da classe:** na visão FIIs e na visão Ações, o "% da carteira" das posições soma 100%.
3. **IR:** o IR de cada ação é o mesmo na visão Ações e em Geral. A isenção de R$ 20 mil não muda com o filtro.
4. **Proventos por tipo:** os totais por tipo da visão Ações batem com os do spec da etapa 1 (§1, item 3), e "Todos os tipos" é a soma deles.
5. **Sem filtro:** sem `?classe=`, cada página mostra o que mostra hoje.
6. **Carteira Alvo e Recomendações:** saem iguais às de hoje, com as mesmas ordens para o mesmo valor de aporte.
7. **Testes:** os novos (§9) passam, e os de hoje continuam passando.

## 2. O que mudou em relação ao plano de origem

| Plano de origem | O que o código mostra | Decisão |
| --- | --- | --- |
| Fases 2 e 3: várias Carteiras Alvo, incluindo de ações, e a cascata rodando uma vez por carteira | As ações ficam fora da estratégia por decisão de 30/10. O motor 3.0 depende de dados de FII (P/VP e vacância do usebolsai, macro Papel/Tijolo, freio de dividendos) | Fora desta etapa. Se voltar, terá spec própria |
| `$match` nas agregações do MongoDB do snapshot | Não há agregações: o snapshot é calculado no código puro (`portfolio/domain`) | O filtro separa os lançamentos e proventos antes do código puro (§4) |
| `router.push` com `?type=fiis` | Os filtros de URL usam `nuqs`, com nomes em português (`?mes=`, `?agrupar=`) | `?classe=fiis\|acoes` com `nuqs` |
| Carteira ligada ao `userId` | A carteira é separada por `portfolioId`, vindo do tenant | Sem mudança de tenancy |
| Script de migração | Nada novo é gravado: a classe já é derivada na leitura | Sem migração |

## 3. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Alcance do filtro | Cada página tem o seu, na URL. Abrir outra página pelo menu começa em Geral | Escolha do dono. Links compartilhados mostram a visão escolhida |
| Base do % | Na visão FIIs ou Ações, o % e as fatias são sobre a classe. Em Geral, sobre o patrimônio todo | Escolha do dono. É o que se compara com a Carteira Alvo |
| Rosca na visão Ações | Só por ativo, sem setor | Escolha do dono. Com 5 ações, a rosca por ativo basta |
| Proventos por tipo | Filtro por tipo e a soma por tipo nos totais | Escolha do dono |
| Páginas com filtro | Dashboard, Proventos, Encerradas e IR, Reinvestimento e Transações | Escolha do dono |
| Reinvestimento por classe | Rateio do total pelas compras de cada classe | Escolha do dono. FIIs + Ações somam o Geral |
| Onde filtrar | No servidor, antes das contas (abordagem A) | Os totais (L/P, DY, evolução, variação) saem certos sem um segundo caminho de cálculo. Calcular as três visões de uma vez triplicaria o trabalho; esconder linhas no navegador daria totais errados |

## 4. Filtro e URL

- **URL:** `?classe=fiis` ou `?classe=acoes`. Sem o parâmetro, ou com um valor desconhecido, a página mostra Geral.
- **Código puro** (`shared/lib/class-filter.ts`: Transações usa o mesmo filtro no cliente, e `shared` não importa features):
  - `ClassFilter = "TODOS" | "FII" | "ACAO"`;
  - `parseClassParam(value: string | string[] | undefined): ClassFilter`: `"fiis"` → `FII`, `"acoes"` → `ACAO`, o resto → `TODOS`;
  - `byClass<T extends { ticker: string }>(items, classOf, filter)`: devolve os itens da classe, ou todos com `TODOS`. `classOf` é o mesmo `assetClassOf` com o mapa do catálogo que o snapshot usa hoje.
- **Seletor:** `AssetClassControl` (`shared/components/asset-class-control.tsx`), um `SegmentedControl` Geral | FIIs | Ações ligado a `?classe=` com `nuqs` e `shallow: false`, porque o servidor lê o valor. Mudar a classe tira o parâmetro de página das tabelas (`?pagina=`), quando a página tem um.
  - Fica no topo do conteúdo, em uma `<Suspense>` própria, fora da seção que recarrega, para não piscar.
  - No celular, ocupa a largura toda.

## 5. Views

Cada view recebe o filtro, com `"TODOS"` como padrão, e separa os lançamentos e os proventos da classe antes de chamar o código puro que já existe. O `cache` do React guarda o resultado por argumento: todas as seções de uma página passam o mesmo filtro, e `getMyTransactions`/`getMyDividends` continuam rodando uma vez por requisição.

- **`getPortfolioSnapshot(filter)`:** filtra lançamentos e proventos. Na visão Ações, os alvos vão vazios, e com eles a Carteira Alvo e os alertas. Na visão FIIs, os alvos vão inteiros (já são só FIIs). A Carteira Alvo e as Recomendações continuam chamando sem argumento.
- **`getEvolution(filter)` e `getPeriodResults(filter)`:** filtram os lançamentos antes de `replayLedger`. O Yahoo só é chamado para os tickers da classe.
- **`getDividendsView(filter, kind)`:** §6.2.
- **`getClosedPositionsView(filter)`:** filtra o razão antes de `closedPositions`. A isenção das ações não precisa de caso especial: na visão Ações e em Geral, o razão filtrado ainda tem todas as vendas de ações; na visão FIIs, não há ação para isentar.
- **`getReinvestmentView(month, filter)`:** §6.4.
- **Classes:** as views que ainda não têm o mapa chamam `getAssetClasses` sobre os tickers que já leram.
- **Observabilidade:** os spans `view.*` ganham o atributo `koinos.view.class_filter` (`TODOS`, `FII` ou `ACAO`). Não é valor da carteira nem id.

## 6. Páginas

### 6.1 Dashboard

- Todos os cartões usam a visão escolhida: resumo, variação da cotação, evolução, aportes mensais, alocação, posições e encerradas.
- **Rosca de categorias e barra de composição do card de patrimônio:**
  - Geral: como hoje, as categorias dos FIIs mais a fatia "Ações";
  - FIIs: as categorias, sem a fatia "Ações";
  - Ações: a rosca de categorias e a barra somem; fica a rosca por ativo.
- **Alertas:** só em Geral e em FIIs.
- A página vazia (`EmptyPortfolio`) continua dependendo da carteira toda. Uma visão sem nenhum ativo da classe, nem aberto nem encerrado, mostra no lugar dos cartões um aviso "Nenhum FII na carteira" ou "Nenhuma ação na carteira".

### 6.2 Proventos

- **Classe:** o "a receber" das ações continua vindo só do snapshot da B3, e a estimativa do Yahoo e o "não divulgado" continuam só para FIIs. A visão Ações mostra só o snapshot da B3 no "a receber".
- **Tipo:** `?tipo=rendimento|reembolso|dividendo|jcp|aluguel`, sem parâmetro = "Todos os tipos", num `NativeSelect` no topo da página, ao lado do seletor de classe, porque filtra a página toda (são 6 opções, muitas para um `SegmentedControl`).
  - Filtra os recebidos e o "a receber" da B3, que já guardam o tipo (`DividendKind`).
  - A estimativa do Yahoo e o "não divulgado" contam como `RENDIMENTO`.
- **Soma por tipo:** os totais do mês e do ano ganham uma linha por tipo, só para os tipos com valor. Com um tipo escolhido, a linha é uma só.
- Os agrupamentos (mês, ano, papel) usam o que sobrou do filtro. O rótulo "Papel" já serve para ações e fica.

### 6.3 Encerradas e IR

- O filtro de classe vale nas duas páginas e no card de encerradas do Dashboard.
- O IR mostra a soma da visão. O IR de cada ação é o mesmo em qualquer visão que a mostre.

### 6.4 Reinvestimento

- A conta de cada mês continua sobre a carteira toda: todos os proventos do mês × a % salva, limitado a todas as compras do mês.
- Na visão FIIs ou Ações:
  - o aporte e a lista de compras são só da classe;
  - "de proventos" da classe = "de proventos" do total × (aporte da classe ÷ aporte total), e 0 quando o aporte total é 0;
  - "do bolso" da classe = aporte da classe − "de proventos" da classe;
  - o card mostra os proventos da carteira toda, com o rótulo "da carteira";
  - o "não gasto" só aparece em Geral, porque é da carteira toda.
- O histórico usa o mesmo rateio mês a mês.
- Salvar a % continua valendo para o mês todo, em qualquer visão.
- O código puro ganha `classShare(total: ReinvestmentSplit, totalAporte, classAporte)` em `portfolio/domain/reinvestment.ts`.

### 6.5 Transações

- Cada linha do DTO de `getMyTransactions` para a UI ganha `assetClass`, vinda de `getAssetClasses` no servidor.
- A classe vira mais um filtro do cliente (`?classe=`, com `nuqs`), junto dos que já existem. Mudar a classe volta para a página 1.

## 7. Celular

- O seletor de classe ocupa a largura toda no topo do conteúdo, com os 44 px de toque do `SegmentedControl`.
- Em Proventos, o tipo fica ao lado do seletor de classe, na mesma linha, e desce para a linha de baixo quando não cabe.

## 8. Erros e limites

- Valor desconhecido em `?classe=` ou `?tipo=` cai em Geral ou "Todos os tipos", sem erro.
- Units fora do catálogo continuam sendo lidas como FII (limite da etapa 1, §4).
- O rateio do Reinvestimento é uma convenção: o dinheiro de proventos não tem classe. Por isso o "não gasto" fica só em Geral.

## 9. Testes

Vitest, só no código puro, ao lado do código:

- `shared/lib/class-filter.test.ts`: `parseClassParam` (fiis, acoes, vazio, desconhecido, array) e `byClass`.
- `portfolio/domain/snapshot.test.ts`: FIIs + Ações = Geral em patrimônio, investido e proventos; o % de cada visão soma 100%; a visão Ações não tem linhas de estratégia nem alertas.
- `portfolio/domain/closed-positions.test.ts`: o IR de uma ação é o mesmo com o razão de ações e com o razão todo, num mês acima e num abaixo dos R$ 20 mil.
- `portfolio/domain/reinvestment.test.ts` (novo): o rateio soma o total; mês sem compra da classe dá 0; aporte total 0 dá 0.
- `portfolio/domain/dividends.test.ts` (novo ou ampliado): o filtro por tipo, a soma por tipo, e a estimativa do Yahoo e o "não divulgado" contando como Rendimento.

Verificação: `format:check`, `lint`, `typecheck`, `test` e `build`. Depois, um script fora do repositório, só de leitura, confere o critério 1 com os dados reais.

## 10. Documentação

- **CLAUDE.md:** o filtro em Rendering (a lista do `nuqs`), as views com filtro em Pages e Domain flow, os tipos de provento em Proventos e os testes novos.
- **Spec da etapa 1:** uma nota no §12 apontando para este spec.

## 11. Fora do escopo

- Várias Carteiras Alvo, Carteira Alvo de ações e recomendações de ações (Fases 2 e 3 do plano de origem).
- Setor das ações.
- Um filtro que valha para o app todo.
