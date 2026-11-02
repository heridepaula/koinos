# Mapa das fórmulas do Koinos

Resumo para orientar a avaliação, conferido no código em 2026-11-01 (Koinos 3.1). O código e as specs (`docs/superpowers/specs/`) mandam: confirme antes de citar uma linha, porque o mapa pode ter ficado para trás.

## Sumário

1. Versões do motor
2. Cascata de FIIs (Koinos 3.0 e 3.1)
3. Smart buy de ações
4. Divisão FIIs/ações e ordens juntas
5. Pesos da Carteira Alvo
6. Reinvestimento
7. Renda e resultado
8. O que os testes já cobrem
9. Decisões do dono
10. Dados que existem e dados que faltam
11. Parece erro, mas é projeto

## 1. Versões do motor

- **Onde:** `src/features/smart-buy/domain/engine-options.ts`. Spec: `2026-11-01-koinos-3-1-design.md`.
- **Opções (`EngineOptions`):** cada regra do conselho é uma chave. `fiiCascade` e `stockSmartBuy` recebem as opções no último argumento, e sem elas rodam a 3.0.

| Opção             | Valores               | O que faz                                                                |
| ----------------- | --------------------- | ------------------------------------------------------------------------ |
| `minOrder`        | `none` ou `fairShare` | FIIs: nenhuma ordem abaixo do mínimo por ordem (a fatia justa do aporte) |
| `suspensionBrake` | `false` ou `true`     | FIIs: provento suspenso tira o FII do aporte                             |
| `stockLot`        | `1` ou `100`          | Ações: tamanho do lote, 1 ou 100 (o lote padrão da B3)                   |
| `stockLeftover`   | `false` ou `true`     | Ações: passo de sobra, um lote por vez                                   |

- **Versões (`ENGINE_VERSIONS`):**
  - **3.0:** `minOrder: none`, `suspensionBrake: false`, `stockLot: 1`, `stockLeftover: false`. É o comportamento de antes do 3.1, e é o que valem os motores sem opções.
  - **3.1:** `minOrder: fairShare`, `suspensionBrake: true`, `stockLot: 100`, `stockLeftover: true`. Liga as quatro.
- **`CURRENT_ENGINE`:** a versão que a tela de Recomendações e a coluna Prioridade usam (hoje `"3.1"`). Mudar a versão corrente muda a tela.
- **`simulateAportes`** (`simulation.ts`): roda os dois motores reais por N aportes com as opções de uma versão. Divide o aporte pela % dos FIIs, executa as ordens de cada período e soma as quantidades à carteira. Os preços ficam parados ou andam por um caminho sorteado (`randomPricePaths`: fator comum + próprio, log-normal, com semente; o P/VP anda junto).
- **`scorecard`** (`scorecard.ts`): as notas de uma versão, uma por lente, com preços parados ou com a média de vários caminhos de preço. Frações em 0..1, `null` onde a classe não tem parte do aporte. As notas:
  - Tiago Reis: % do aporte investido (FIIs, ações e total), estabilidade (fração do primeiro aporte que troca de ativo com ruído de 1% nos preços) e compras fora do método (precisa dar zero);
  - Baroni: desvio da meta dos FIIs (no fim e a média por período), FIIs que receberam ordem, peso por macro contra a meta, ordens de FII por período e a menor ordem;
  - Buffett: rank médio pelo dinheiro e % do gasto em FII com freio de proventos ou de vacância;
  - Barsi: caixa parado nas ações e ordens e lotes de ação por período.
- **No laboratório:** `--versao` escolhe a versão de `recomendar`, `projetar`, `choque` e `mes`, e `comparar --a 3.0 --b 3.1` mostra o primeiro aporte e as notas das duas lado a lado. As notas de renda real e de DY contra a inflação ficam para a spec do SGS.

## 2. Cascata de FIIs (Koinos 3.0 e 3.1)

- **Onde:**
  - `src/features/smart-buy/domain/fii-cascade.ts`: `fiiCascade` e `aportePriorities`.
  - Tensores em `conviction.ts` e travas em `risk.ts`.
  - A entrada (`cascadeInput`) é montada em `src/features/portfolio/domain/snapshot.ts`.
- **Specs:** `2026-10-30-koinos-3-0-design.md`; o viés vem de `2026-10-31-tabelas-unificadas-design.md`; o mínimo por ordem e a suspensão, de `2026-11-01-koinos-3-1-design.md`.
- **Entrada por FII:** rank, teto, peso (fração; os pesos da estratégia somam 1), preço, quantidade, preço médio, P/VP, último provento por cota, proventos de 12 meses por cota, nº de pagamentos na janela de 12 meses (`dividendPayments12m`), dias desde o último provento (`daysSinceLastDividend`), vacância física (fração), macro, setor e viés.
- **Elegibilidade:** é avaliada na ordem abaixo, e a primeira regra que falha dá o motivo. O FII de fora não entra nos dois passos, mas o valor dele continua na base da estratégia.
  1. Sem cotação: `SEM_COTACAO`.
  2. Sem rank: `SEM_RANKING`.
  3. Sem teto: `SEM_TETO`.
  4. Preço ≥ teto: `ACIMA_DO_TETO`.
  5. Viés Aguardar: `AGUARDAR`.
  6. Provento suspenso (3.1, `suspensionBrake`): `PROVENTO_SUSPENSO`.
- **Suspensão (3.1):** um FII está suspenso quando faz mais de 45 dias da última data ex e ele pagou ao menos 6 vezes na janela de 12 meses (pagador regular), ou quando faz mais de 365 dias, mesmo com poucos pagamentos.
  - `daysSinceLastDividend` só existe com a busca de proventos feita há até 10 dias. Sem ela, ou sem histórico, a regra é neutra: o FII não é tirado.
  - Com 5 pagamentos e 60 dias, o FII não é suspenso: ainda não é pagador regular.
- **Meta:** alvo = peso × (valor da estratégia + aporte), e gap = alvo − valor. O valor da estratégia soma só os FIIs dela; FII sem cotação vale pelo preço médio.
- **Pedido:** se gap > 0, o pedido é gap × valuation × proventos × segurança × vacância. Sem gap, o pedido é 0.
  - Valuation = max(0, 2 − P/VP). P/VP 0,90 dá 1,10; sem P/VP, 1.
  - Proventos = min(1, último ÷ (12 meses ÷ 12)). É o freio de corte: um provento extraordinário não acelera. Sem histórico, 1.
  - Segurança = 1 + max(0, (teto − preço) ÷ teto).
  - Vacância = 1 − vacância física, só no tijolo. Sem dado, 1.
- **Travas:** frações do aporte em `RISK_CAPS`.
  - **Limites:** 25% por FII, 35% por setor e 60% por macro.
  - **Setor:** só tijolo com segmento específico forma setor. "Multicategoria", "Outros", "Híbrido" e "Títulos e Val. Mob." não formam, então metade dos FIIs não divide trava de setor.
  - **Macro:** vem do `fundType` da usebolsai. Papel e Fiagro contam como Papel; Tijolo, como Tijolo; Híbrido vai pela composição (paperPct × realEstatePct); FoF vai para Outros. Sem tipo, decide a categoria da Carteira Alvo.
- **Mínimo por ordem (3.1, `minOrder: fairShare`):** mínimo = `round2(min(aporte ÷ nº de FIIs, 12,5% do aporte))`.
  - O nº de FIIs é o da entrada inteira da cascata, contando os que estão fora do aporte.
  - O 12,5% é a guarda para poucos FIIs: metade da trava de 25% por FII, para a fatia justa nunca passar dela.
  - Com aporte zero, ou sem FIIs, o mínimo é zero. `CascadeResult.minimum` traz o valor, e é zero na 3.0.
- **Passo 1:** na ordem do ranking (empate: ticker), cada FII compra o menor entre o pedido, o espaço nas três travas e o saldo, em cotas inteiras arredondadas para baixo. `limitedBy` diz o que cortou.
  - Na 3.0 não há mínimo, nem o de uma cota.
  - Na 3.1, a ordem que não chega ao mínimo é pulada, e o dinheiro fica para os próximos da fila.
- **Passo 2, a sobra:** uma cota por vez vai para o FII com a menor razão (valor + comprado) ÷ (alvo × freio de proventos × freio de vacância), entre os que cabem nas travas e no saldo. No empate, ganha o melhor ranking. Para quando nenhuma cota cabe; o troco fica em caixa.
  - Na 3.1, a sobra completa uma ordem que já existe, com 1 cota por vez, e só abre uma ordem nova quando compra ⌈mínimo ÷ preço⌉ cotas de uma vez.
- **Quem não recebe:** `NA_META` (gap ≤ 0), `PEDIDO_PEQUENO` (pediu menos de uma cota), `ABAIXO_DO_MINIMO` (3.1: o pedido, em cotas inteiras, não chega ao mínimo), `LIMITE_ATIVO`, `LIMITE_SETOR`, `LIMITE_MACRO` e `SEM_SALDO`.
  - Se foi uma trava ou o saldo que cortou o pedido abaixo do mínimo, vale o motivo da trava, não `ABAIXO_DO_MINIMO`.
  - `PROVENTO_SUSPENSO` (3.1) vem da elegibilidade e deixa o FII fora dos dois passos.
- **`aportePriorities`:** a coluna Prioridade, calculada com aporte zero e com as opções da versão corrente. Marca `PROVENTO_SUSPENSO`; o mínimo é zero com aporte zero, então `ABAIXO_DO_MINIMO` não aparece nela.
- **Fontes dos dados:** P/VP e perfil vêm da usebolsai (cron das 2h); P/VP e vacância com mais de 60 dias contam como ausentes. Proventos vêm do Yahoo, com a janela da seção 10.

## 3. Smart buy de ações

- **Onde:** `src/features/smart-buy/domain/stock-buy.ts` (`stockSmartBuy` e `stockPriorities`). A entrada (`stockBuyInput`) é montada no snapshot.
- **Specs:** `2026-10-31-smart-buy-acoes-design.md`, mudada por `2026-10-31-tabelas-unificadas-design.md` e, no lote e na sobra, por `2026-11-01-koinos-3-1-design.md`. Origem: o documento do dono "Smart Buy Ações (Dividendos)".
- **Entrada:** rank, teto, preço, quantidade, peso (fração) e viés.
- **Base e meta:** base = valor das ações da estratégia (quantidade × preço; ação sem cotação vale 0) + a parte do aporte das ações. Meta = base × peso.
- **Elegibilidade:** é avaliada na ordem abaixo. O rank não é exigido.
  1. Sem cotação.
  2. Sem teto.
  3. Preço > teto.
  4. Viés Aguardar.
  5. Déficit ≤ 0: `NA_META`.
  6. Déficit menor que um lote: `MENOS_DE_UM_LOTE` na 3.1 (lote de 100); com lote 1, é `PEDIDO_PEQUENO` (menor que uma ação).
- **Ordem:** pela margem de segurança MS = teto ÷ preço − 1, a maior primeiro. Empate: rank, depois ticker.
- **Compra (passo 1):** cada ação compra lotes inteiros até o menor entre o déficit e o saldo. O lote é de 100 ações na 3.1 e de 1 na 3.0. Quem não coube fica `SEM_SALDO`.
- **Sobra (3.1, `stockLeftover`):** um lote por vez para a ação com a menor razão (valor + comprado) ÷ meta, entre as que podem receber: com cotação, com teto, preço ≤ teto, sem Aguardar e com peso. Para quando nenhum lote cabe no caixa ou no limite (`STOCK_LEFTOVER_CAP`, decisão do dono em 2026-11-01).
  - Pela sobra, nenhuma ação passa de no máximo o maior entre 25% da parte das ações do aporte e um lote; só a sobra é limitada, e o que não cabe fica em caixa.
  - A ação pode passar da meta, como na sobra dos FIIs.
  - Uma ação que ficou em `MENOS_DE_UM_LOTE` pode receber pela sobra, se for a mais abaixo da meta.
  - `StockBuyOrder.fromLeftover` diz quantas ações vieram da sobra, e `lot` o tamanho do lote.
- **`stockPriorities`:** a fila é a das ações que pedem ao menos um lote, com os motivos de quem não pede (inclusive `MENOS_DE_UM_LOTE`).
- **O que não tem:** trava por ação, tensores e critério de proventos. Na 3.0 também não há passo de sobra: o resto fica em caixa.

## 4. Divisão FIIs/ações e ordens juntas

- **Divisão:** `splitAmount(valor, %FIIs)` em `aporte-split.ts` trabalha em centavos inteiros: os FIIs levam a parte arredondada para baixo e as ações, o resto.
  - A % é escolhida na tela a cada aporte (`?fiis=`, slider de 5 em 5%). A visão FIIs (100%) é o padrão.
- **Sobra:** cada carteira guarda a sua sobra, e nada passa de uma para a outra.
- **Ordens juntas:** `mergeOrders` (`merge-orders.ts`) junta as ordens das duas carteiras por total decrescente (empate: ticker). É a tabela única da visão Geral.

## 5. Pesos da Carteira Alvo

- **`effectiveWeights`** (`src/features/strategy/domain/weights.ts`):
  - **Regra:** sem nenhuma %, os pesos são iguais. Com algumas, o que falta para 100% é dividido igualmente entre os ativos sem %. No fim, tudo é normalizado para somar 1.
  - **Aviso:** aparece quando a soma não é 100.
  - **Por classe:** cada classe (FII e ação) tem a sua estratégia e o seu cálculo.
- **Quarentena:** 0% só é aceito fora da estratégia e marca quarentena. O ativo fora da estratégia nunca recebe, e o valor dele não entra na meta.
- **`suggestPercentFix`:** o ajuste com uma casa decimal (pelo maior resto) que o painel grava.
- **Teto** (`ceiling.ts`):
  - `marginToCeiling` = (teto − preço) ÷ teto;
  - `isSuspiciousCeiling` marca o teto abaixo de 50% ou acima de 200% do preço.
  - `ceilingCheck` (`CEILING_CHECK`): teto calculado = proventos de 12 meses ÷ (NTN-B real + spread); tijolo e demais classes + 1,0 p.p., papel + 4,0% de IPCA assumido + 1,0 p.p. Avisa (só informativo) quando difere do teto do ranking em mais de 10%, nos dois lados, e só para FIIs da estratégia com proventos de até 10 dias e taxa em dia.

## 6. Reinvestimento

- **Onde:** `src/features/portfolio/domain/reinvestment.ts`. Spec `2026-10-23-reinvestimento-design.md`.
- **Regra:** as compras em dinheiro do mês (negócios e subscrições, com taxas) são divididas entre dinheiro de proventos e dinheiro do bolso. O reinvestido pretendido é proventos × % do mês, limitado ao que foi comprado.
- **% do mês:** fica salva por mês; sem % salva, vale 100% (no método Koinos, todo provento volta para a carteira).
- **Por classe:** a conta continua sobre a carteira inteira, e a parte "de proventos" de uma classe é rateada pelo aporte dela (`shareReinvestment`).

- **Fruição** (`smart-buy/domain/income-phase.ts`, spec `2026-11-01-fruicao-design.md`): `IncomePhase` é acumulação (todo provento volta) ou fruição com `retention` (padrão 25%, de 20% a 100%; abaixo, `fruition()` lança erro). `splitIncome` divide em centavos, com a retenção para cima. A fase não entra nos motores: só decide o valor do aporte. `simulateAportes` aceita `phase`, `stockDividends` e `otherIncome`; o laboratório tem `fruicao`. Não há tela nem configuração ainda.

## 7. Renda e resultado

São as fórmulas que as lentes de renda costumam olhar:

- **`dividendPace`:** total e média dos últimos 12 meses fechados, ano atual e ano anterior.
- **`incomeVsAverage` e `yieldOnCost`:** a renda estimada do mês contra a média de 12 meses, e a estimativa anual ÷ investido.
- **`adjustedResult`:** o resultado "com proventos" (cotação + proventos) e o "total" (+ vendas realizadas).
- **`computeEvolution`:** patrimônio × investido no fim de cada mês.
- **`periodResults`:** L/P da semana, do mês e do ano, só pela cotação.
- **`closed-positions.ts`:** IR estimado das posições encerradas. FII paga 20% do lucro; ação paga 15% no mês em que as vendas de ações passam de R$ 20 mil, e até isso é isenta.

## 8. O que os testes já cobrem

Ver a seção Tests do CLAUDE.md. Em resumo:

- **`fii-cascade.test.ts`:** os cenários A, B e C do dono, os casos de Aguardar, o mínimo por ordem e a suspensão da 3.1, e invariantes em 500 carteiras aleatórias com semente. A 3.0 (sem opções) dá o mesmo resultado de antes.
- **Outros de `smart-buy/domain`:**
  - os tensores (`conviction.test.ts`) e as travas e baldes (`risk.test.ts`);
  - o smart buy de ações (lote e sobra incluídos) e `stockPriorities` (`stock-buy.test.ts`);
  - `mergeOrders` (`merge-orders.test.ts`) e `splitAmount` (`aporte-split.test.ts`);
  - a simulação de aportes (`simulation.test.ts`) e as notas das lentes (`scorecard.test.ts`).
- **`market-data/domain`:** a janela de proventos de 12 meses de calendário (`dividend-window.test.ts`).
- **`strategy/domain`:** os pesos (`weights.test.ts`) e a quarentena (`quarantine.test.ts`).
- **`portfolio/domain`:** o snapshot, os alertas, o reinvestimento, os proventos e as encerradas.

## 9. Decisões do dono

As lentes podem discordar destas decisões; a síntese marca o conflito, mas não as trata como erro.

- **Venda:** rebalancear só com dinheiro novo, nunca vendendo.
- **Travas:** fixas em 25%, 35% e 60% por aporte. O documento do Koinos 3.0 dizia 20% por FII; o dono escolheu 25%.
- **Divisão:**
  - A % FIIs/ações é escolhida na tela a cada aporte; a meta por classe foi removida em 2026-10-31.
  - As % das ações são reescaladas para 100%, o que substituiu "o resto fica em caixa".
- **Viés:** Aguardar tira FIIs e ações do aporte; Comprar e vazio não mudam nada.
- **Tensores:**
  - Os contínuos substituíram o Índice de Convicção (degraus ×1,2, ×1 e ×0,5).
  - O IPA da planilha antiga não volta.
- **Fontes:**
  - Ranking, teto, % e viés vêm do ranking, digitados pelo dono.
  - O P/VP vem da usebolsai. A StatusInvest foi recusada pelos termos de uso.
  - Nada de B3: os dados dela só entram pelos extratos que o dono envia.
  - Os proventos vêm do Yahoo, que bateu melhor com os extratos.
- **Histórico:** os proventos começam no primeiro extrato (nov/2019).
- **Smart buy de ações:** sem trava por ação e sem tensores, como no documento do dono.
- **Proposta de 4 regras (2026-11-01):** teto e Aguardar já existiam; VENDER foi recusado ("nunca vender"; o equivalente é a quarentena); o desempate por DY nominal foi recusado (puxa para papel e para quem cortou provento); a fruição foi implementada com retenção padrão de 25% e piso de 20%.
- **Koinos 3.1 (spec de 2026-11-01), as decisões novas:**
  - **Lote e sobra das ações:** o lote de 100 e a sobra por lote substituem o "sem passo de sobra" do documento do dono. A ação pode passar da meta.
  - **Mínimo por ordem nos FIIs:** nenhuma ordem abaixo da fatia justa (aporte ÷ nº de FIIs), com a guarda de 12,5% do aporte.
  - **Freio de suspensão:** o FII que pagava com regularidade e está há mais de 45 dias sem data ex (ou há mais de 365 dias sem pagar) sai do aporte.
  - **Proventos em 12 meses de calendário:** o `dividends12m` soma os 12 meses que terminam no mês do último pagamento, e não 365 dias contados de hoje.

## 10. Dados que existem e dados que faltam

**Existem:**

- **FIIs:**
  - preço (brapi, com o Yahoo de reserva);
  - P/VP, vacância física, segmento, tipo, % em papel e % em imóveis (usebolsai, até 60 dias);
  - último provento, soma de 12 meses, nº de pagamentos na janela e anúncios dos últimos 90 dias (Yahoo), com a janela explicada abaixo;
  - fechamentos mensais e diários recentes;
  - rank, teto, %, viés e categoria (Carteira Alvo).
- **Ações:** preço, proventos (Yahoo), fechamentos, rank, teto, % e viés. Não há setor: a categoria é sempre "Ação".
  - Na prática, só os ativos que estão na carteira têm proventos gravados. Ações da Carteira Alvo ainda não compradas aparecem sem DY no `snapshot`.
- **Janela dos proventos** (`market-data/domain/dividend-window.ts`):
  - `dividends12m` soma os 12 meses de calendário (UTC) que terminam no mês do último provento (data ex). Um FII mensal sempre soma 12 pagamentos; a janela de 365 dias a partir de hoje pegava 11 ou 13, conforme o dia do mês.
  - `dividendPayments12m` conta os pagamentos da janela, e alimenta a regra de suspensão (≥ 6). Dois pagamentos no mesmo mês entram os dois.
  - Se o último provento tem mais de 365 dias, o total e a contagem são zero.
  - A busca no Yahoo traz 760 dias, para a janela caber.
  - O último provento não some: uma busca que dá certo e não traz nenhum provento mantém o `lastDividend` gravado. Se a busca falha, nada é gravado.
  - `dividendsFetchedAt` diz quando a busca foi feita, e a suspensão só vale com ela de até 10 dias.
  - O freio de proventos e o DY da tela usam a mesma soma nas duas versões, então a comparação 3.0 × 3.1 usa o mesmo dado.
- **Carteira:**
  - os lançamentos (extratos da B3 desde nov/2019 e as posições anteriores);
  - os proventos recebidos por ativo;
  - a % reinvestida por mês;
  - as encerradas e a evolução mensal.
- **Taxa real da NTN-B 2035** (Tesouro Transparente, `treasury_rates`, `getRealRate`): média de compra e venda por pregão desde 2006, a mediana dos últimos 60 pregões e a diferença para o último. Só o aviso de divergência do teto usa (informativo); nenhum motor nem decisão de compra. A fonte é aberta (ODbL) e foi liberada pelo dono. Um teto calculado com ela precisa casar yield **real** com taxa real (ou os dois nominais).

**Faltam:**

- **Gerais:** IPCA, Selic e CDI. O dono escolheu o SGS do Banco Central como fonte, numa spec própria depois do Koinos 3.1.
- **Ações:** fundamentos (lucro, ROE, payout, dívida), setor e histórico longo de dividendos.
- **FIIs:** vacância financeira, prazo dos contratos (WALT), inquilinos, índice de reajuste, alavancagem, qualidade da carteira de CRI (LTV, indexador), liquidez e emissões.
- **Índices:** o IFIX só tem a cotação do dia (`IFIX.SA`), sem histórico, na brapi e no Yahoo; o XFIX11, ETF do IFIX, tem histórico no Yahoo. O Ibovespa tem histórico (`^BVSP`) na brapi e no Yahoo.

Uma fonte nova é decisão de produto. A B3 está fora, e a StatusInvest foi recusada. Num teste com as chaves do app, em 2026-10-31:

- **brapi:** o macro (`/api/v2/macro`) responde 403 no plano grátis e exige o Startup.
- **usebolsai:** o macro (`/api/v1/macro/...`) responde 403 e exige o Pro.
- **SGS do Banco Central:** é grátis e não pede chave. Séries: 433 (IPCA do mês), 13522 (IPCA em 12 meses), 432 (Selic meta), 4389 (CDI ao ano) e 189 (IGP-M).

## 11. Parece erro, mas é projeto

Confira esta lista antes de apontar um erro.

- **Teto calculado × teto do ranking:** o triângulo de divergência não muda ordem, Prioridade nem alerta, e o teto que decide a compra continua o do ranking. O teto calculado reproduz o do ranking na mediana (97%), mas varia com a taxa: o IPCA do papel é um número fixo (4,0%) e o tijolo compara provento nominal com taxa real de propósito (o aluguel acompanha a inflação).
- **Travas por aporte:** valem sobre cada aporte, não sobre a composição da carteira. Quem segura a composição são as % do ranking.
- **Meta com aporte:** o alvo já inclui o aporte (peso × (estratégia + aporte)).
- **Tensores passam da meta:** como multiplicam o gap, o FII pode terminar acima da meta. É de propósito.
- **Preço igual ao teto:** o FII com preço igual ao teto fica fora; a ação com preço igual ao teto entra. Está documentado assim nas specs e no CLAUDE.md.
- **Duas margens:**
  - A Carteira Alvo e os FIIs usam (teto − preço) ÷ teto.
  - O motor de ações usa teto ÷ preço − 1.
  - A ordem é a mesma, mas os números na tela diferem: BBAS3 a 16,47 com teto 25 mostra margem de 34,1% na Carteira Alvo e 51,8% no "Por quê".
  - Isso pode confundir o dono; não é erro de ordenação.
- **Sem cotação:** a ação sem cotação vale zero na base; o FII sem cotação vale pelo preço médio.
- **Dado velho:** P/VP e vacância com mais de 60 dias deixam o tensor neutro.
- **Sobra:** cada classe guarda a sua.
- **FIIs fora da estratégia:** só os FIIs da estratégia formam a base. Os de fora (legado) não entram na meta e podem concentrar o patrimônio sem a cascata ver.
- **Ranking no passo 1:** um FII mais abaixo da meta, mas pior ranqueado, só recebe o que sobra dos que estão à frente. É o método Koinos; avalie a consequência, sem chamar de bug.
- **Mínimo por ordem (3.1):** com o mínimo, um FII abaixo da meta pode ficar sem ordem (`ABAIXO_DO_MINIMO`): o pedido dele não chegava à fatia justa. O dinheiro vai para os próximos da fila, e no próximo aporte o pedido cresce. É a regra funcionando.
- **Lote de 100 (3.1):** com o lote, uma ação comprada pode passar da meta, porque a compra é em lote inteiro e a sobra vai um lote por vez para a mais abaixo da meta. Há ações com um lote maior que a meta (a spec do 3.1 cita TUPY3, UNIP6 e VALE3). Uma ação com `MENOS_DE_UM_LOTE` pode receber pela sobra.
- **Suspensão sem dado (3.1):** o FII com provento atrasado só sai do aporte quando a busca de proventos tem até 10 dias. Sem ela, a regra fica neutra; não é falha da regra.
