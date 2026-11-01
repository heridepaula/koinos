# Mapa das fórmulas do Koinos

Resumo para orientar a avaliação, conferido no código em 2026-10-31. O código e as specs (`docs/superpowers/specs/`) mandam: confirme antes de citar uma linha, porque o mapa pode ter ficado para trás.

## Sumário

1. Cascata de FIIs (Koinos 3.0)
2. Smart buy de ações
3. Divisão FIIs/ações e ordens juntas
4. Pesos da Carteira Alvo
5. Reinvestimento
6. Renda e resultado
7. O que os testes já cobrem
8. Decisões do dono
9. Dados que existem e dados que faltam
10. Parece erro, mas é projeto

## 1. Cascata de FIIs (Koinos 3.0)

- **Onde:**
  - `src/features/smart-buy/domain/suno-cascade.ts`: `sunoCascade` e `aportePriorities`.
  - Tensores em `conviction.ts` e travas em `risk.ts`.
  - A entrada (`cascadeInput`) é montada em `src/features/portfolio/domain/snapshot.ts`.
- **Specs:** `2026-10-30-koinos-3-0-design.md`; o viés vem de `2026-10-31-tabelas-unificadas-design.md`.
- **Entrada por FII:** rank, teto, peso (fração; os pesos da estratégia somam 1), preço, quantidade, preço médio, P/VP, último provento por cota, proventos de 12 meses por cota, vacância física (fração), macro, setor e viés.
- **Elegibilidade:** é avaliada na ordem abaixo, e a primeira regra que falha dá o motivo. O FII de fora não entra nos dois passos, mas o valor dele continua na base da estratégia.
  1. Sem cotação: `SEM_COTACAO`.
  2. Sem rank: `SEM_RANKING`.
  3. Sem teto: `SEM_TETO`.
  4. Preço ≥ teto: `ACIMA_DO_TETO`.
  5. Viés Aguardar: `AGUARDAR`.
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
- **Passo 1:** na ordem do ranking (empate: ticker), cada FII compra o menor entre o pedido, o espaço nas três travas e o saldo, em cotas inteiras arredondadas para baixo, sem mínimo de uma cota. `limitedBy` diz o que cortou.
- **Passo 2, a sobra:** uma cota por vez vai para o FII com a menor razão (valor + comprado) ÷ (alvo × freio de proventos × freio de vacância), entre os que cabem nas travas e no saldo. No empate, ganha o melhor ranking. Para quando nenhuma cota cabe; o troco fica em caixa.
- **Quem não recebe:** `NA_META` (gap ≤ 0), `PEDIDO_PEQUENO` (pediu menos de uma cota), `LIMITE_ATIVO`, `LIMITE_SETOR`, `LIMITE_MACRO` e `SEM_SALDO`.
- **`aportePriorities`:** a coluna Prioridade, calculada com aporte zero.
- **Fontes dos dados:** P/VP e perfil vêm da usebolsai (cron das 2h); P/VP e vacância com mais de 60 dias contam como ausentes. Proventos vêm do Yahoo.

## 2. Smart buy de ações

- **Onde:** `src/features/smart-buy/domain/stock-buy.ts` (`stockSmartBuy` e `stockPriorities`). A entrada (`stockBuyInput`) é montada no snapshot.
- **Specs:** `2026-10-31-smart-buy-acoes-design.md`, mudada por `2026-10-31-tabelas-unificadas-design.md`. Origem: o documento do dono "Smart Buy Ações (Dividendos)".
- **Entrada:** rank, teto, preço, quantidade, peso (fração) e viés.
- **Base e meta:** base = valor das ações da estratégia (quantidade × preço; ação sem cotação vale 0) + a parte do aporte das ações. Meta = base × peso.
- **Elegibilidade:** é avaliada na ordem abaixo. O rank não é exigido.
  1. Sem cotação.
  2. Sem teto.
  3. Preço > teto.
  4. Viés Aguardar.
  5. Déficit ≤ 0: `NA_META`.
  6. Déficit menor que uma ação: `PEDIDO_PEQUENO`.
- **Ordem:** pela margem de segurança MS = teto ÷ preço − 1, a maior primeiro. Empate: rank, depois ticker.
- **Compra:** cada ação compra cotas inteiras até o menor entre o déficit e o saldo; quem não coube fica `SEM_SALDO`.
- **O que não tem:** trava por ação, tensores, critério de proventos e passo de sobra (o resto fica em caixa).

## 3. Divisão FIIs/ações e ordens juntas

- **Divisão:** `splitAmount(valor, %FIIs)` em `aporte-split.ts` trabalha em centavos inteiros: os FIIs levam a parte arredondada para baixo e as ações, o resto.
  - A % é escolhida na tela a cada aporte (`?fiis=`, slider de 5 em 5%). A visão FIIs (100%) é o padrão.
- **Sobra:** cada carteira guarda a sua sobra, e nada passa de uma para a outra.
- **Ordens juntas:** `mergeOrders` (`merge-orders.ts`) junta as ordens das duas carteiras por total decrescente (empate: ticker). É a tabela única da visão Geral.

## 4. Pesos da Carteira Alvo

- **`effectiveWeights`** (`src/features/strategy/domain/weights.ts`):
  - **Regra:** sem nenhuma %, os pesos são iguais. Com algumas, o que falta para 100% é dividido igualmente entre os ativos sem %. No fim, tudo é normalizado para somar 1.
  - **Aviso:** aparece quando a soma não é 100.
  - **Por classe:** cada classe (FII e ação) tem a sua estratégia e o seu cálculo.
- **Quarentena:** 0% só é aceito fora da estratégia e marca quarentena. O ativo fora da estratégia nunca recebe, e o valor dele não entra na meta.
- **`suggestPercentFix`:** o ajuste com uma casa decimal (pelo maior resto) que o painel grava.
- **Teto** (`ceiling.ts`):
  - `marginToCeiling` = (teto − preço) ÷ teto;
  - `isSuspiciousCeiling` marca o teto abaixo de 50% ou acima de 200% do preço.

## 5. Reinvestimento

- **Onde:** `src/features/portfolio/domain/reinvestment.ts`. Spec `2026-10-23-reinvestimento-design.md`.
- **Regra:** as compras em dinheiro do mês (negócios e subscrições, com taxas) são divididas entre dinheiro de proventos e dinheiro do bolso. O reinvestido pretendido é proventos × % do mês, limitado ao que foi comprado.
- **% do mês:** fica salva por mês; sem % salva, vale 100% (no método Suno, todo provento volta para a carteira).
- **Por classe:** a conta continua sobre a carteira inteira, e a parte "de proventos" de uma classe é rateada pelo aporte dela (`shareReinvestment`).

## 6. Renda e resultado

São as fórmulas que as lentes de renda costumam olhar:

- **`dividendPace`:** total e média dos últimos 12 meses fechados, ano atual e ano anterior.
- **`incomeVsAverage` e `yieldOnCost`:** a renda estimada do mês contra a média de 12 meses, e a estimativa anual ÷ investido.
- **`adjustedResult`:** o resultado "com proventos" (cotação + proventos) e o "total" (+ vendas realizadas).
- **`computeEvolution`:** patrimônio × investido no fim de cada mês.
- **`periodResults`:** L/P da semana, do mês e do ano, só pela cotação.
- **`closed-positions.ts`:** IR estimado das posições encerradas. FII paga 20% do lucro; ação paga 15% no mês em que as vendas de ações passam de R$ 20 mil, e até isso é isenta.

## 7. O que os testes já cobrem

Ver a seção Tests do CLAUDE.md. Em resumo:

- **`suno-cascade.test.ts`:** os cenários A, B e C do dono, os casos de Aguardar e invariantes em 500 carteiras aleatórias com semente.
- **Outros de `smart-buy/domain`:**
  - os tensores (`conviction.test.ts`) e as travas e baldes (`risk.test.ts`);
  - o smart buy de ações e `stockPriorities` (`stock-buy.test.ts`);
  - `mergeOrders` (`merge-orders.test.ts`) e `splitAmount` (`aporte-split.test.ts`).
- **`strategy/domain`:** os pesos (`weights.test.ts`) e a quarentena (`quarantine.test.ts`).
- **`portfolio/domain`:** o snapshot, os alertas, o reinvestimento, os proventos e as encerradas.

## 8. Decisões do dono

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
  - Ranking, teto, % e viés vêm da Suno, digitados pelo dono.
  - O P/VP vem da usebolsai. A StatusInvest foi recusada pelos termos de uso.
  - Nada de B3: os dados dela só entram pelos extratos que o dono envia.
  - Os proventos vêm do Yahoo, que bateu melhor com os extratos.
- **Histórico:** os proventos começam no primeiro extrato (nov/2019).
- **Smart buy de ações:** sem trava por ação e sem tensores, como no documento do dono.

## 9. Dados que existem e dados que faltam

**Existem:**

- **FIIs:**
  - preço (brapi, com o Yahoo de reserva);
  - P/VP, vacância física, segmento, tipo, % em papel e % em imóveis (usebolsai, até 60 dias);
  - último provento, soma de 12 meses e anúncios dos últimos 90 dias (Yahoo);
  - fechamentos mensais e diários recentes;
  - rank, teto, %, viés e categoria (Carteira Alvo).
- **Ações:** preço, proventos (Yahoo), fechamentos, rank, teto, % e viés. Não há setor: a categoria é sempre "Ação".
  - Na prática, só os ativos que estão na carteira têm proventos gravados. Ações da Carteira Alvo ainda não compradas aparecem sem DY no `snapshot`.
- **Carteira:**
  - os lançamentos (extratos da B3 desde nov/2019 e as posições anteriores);
  - os proventos recebidos por ativo;
  - a % reinvestida por mês;
  - as encerradas e a evolução mensal.

**Faltam:**

- **Gerais:** IPCA, Selic e CDI. O dono escolheu o SGS do Banco Central como fonte, numa spec própria depois do Koinos 3.1.
- **Ações:** fundamentos (lucro, ROE, payout, dívida), setor e histórico longo de dividendos.
- **FIIs:** vacância financeira, prazo dos contratos (WALT), inquilinos, índice de reajuste, alavancagem, qualidade da carteira de CRI (LTV, indexador), liquidez e emissões.
- **Índices:** o IFIX só tem a cotação do dia (`IFIX.SA`), sem histórico, na brapi e no Yahoo; o XFIX11, ETF do IFIX, tem histórico no Yahoo. O Ibovespa tem histórico (`^BVSP`) na brapi e no Yahoo.

Uma fonte nova é decisão de produto. A B3 está fora, e a StatusInvest foi recusada. Num teste com as chaves do app, em 2026-10-31:

- **brapi:** o macro (`/api/v2/macro`) responde 403 no plano grátis e exige o Startup.
- **usebolsai:** o macro (`/api/v1/macro/...`) responde 403 e exige o Pro.
- **SGS do Banco Central:** é grátis e não pede chave. Séries: 433 (IPCA do mês), 13522 (IPCA em 12 meses), 432 (Selic meta), 4389 (CDI ao ano) e 189 (IGP-M).

## 10. Parece erro, mas é projeto

Confira esta lista antes de apontar um erro.

- **Travas por aporte:** valem sobre cada aporte, não sobre a composição da carteira. Quem segura a composição são as % da Suno.
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
- **Ranking no passo 1:** um FII mais abaixo da meta, mas pior ranqueado, só recebe o que sobra dos que estão à frente. É o método Suno; avalie a consequência, sem chamar de bug.
