# Independência financeira v2: custos perpétuos, fundo temporário e saúde por idade

Data: 2026-11-07. Origem: a "Especificação v2.0" que o dono colou no mesmo dia, depois da v1 (`2026-11-07-independencia-financeira-design.md`) já estar em produção, ajustada no brainstorming. Esta spec substitui as regras da v1 (§2 e §3 dela). O que não muda: o aporte médio (§2.4 da v1), a página `/independencia`, a linha discreta no topo do Dashboard e a coleção `independence_plans`.

## 1. O que a v2 pedia e o que mudou

| v2 colada | Decisão | Por quê |
| --- | --- | --- |
| Taxa real constante de 0,4% a.m. no lugar do DY | Aceito: a meta perpétua é a renda ÷ 0,004, e o prazo usa o mesmo r | Escolha do dono. A v1 já era necessidade ÷ r (com r = yield × (1 − retenção)); a v2 troca o r. A retenção e o yield da carteira saem da feature |
| Fundo de educação somado desde hoje | Só os anos depois da idade alvo, levados à idade alvo | Até a independência quem paga a escola é o salário |
| Saúde na faixa da idade alvo, para sempre | Degraus da tabela: cada aumento de faixa é uma perpetuidade adiada | Quem se aposenta aos 45 paga R$ 735 e, a partir dos 59, R$ 1.725 (Conforto); congelar subestima |
| Saúde × "quem ainda será dependente na idade alvo" | Titular (e cônjuge) na perpetuidade; a saúde dos filhos no fundo temporário | O texto deixava o titular sem plano, e a saúde dos filhos acaba, como a escola |
| Tabela de saúde com 3 faixas | As 10 faixas, pelo ponto médio do levantamento de 2026 do dono | As 3 faixas da v2 são exatamente esses pontos médios (39–43: 350/550/850) |
| Prazo em anos (`floor`) e ano | Meses inteiros (para cima), mês e idade prevista, mais a folga ou o aporte necessário para a idade alvo | Escolha do dono |
| `framer-motion`, `react-number-format`, `Progress` do Radix, `POST/GET /api/fire-plan` | `MoneyInput`, molas em CSS, Base UI, Server Action e DAL | Padrão do projeto |
| Dependentes: quantos e a idade do mais novo | Mantido, com a escola e a saúde dos filhos até o mais novo sair do orçamento | Conservador: os mais velhos terminam antes. Pedir a idade de cada filho fica para depois |

## 2. Regra (`src/features/independence/domain/`, pura)

### 2.1 Constantes (`constants.ts`)

| Constante | Valor | Uso |
| --- | --- | --- |
| `REAL_MONTHLY_RATE` | 0,004 (≈ 4,91% a.a.) | Perpetuidade, saúde e prazo |
| `EDUCATION_INFLATION` | 8% a.a. | Correção da mensalidade |
| `NOMINAL_ANNUAL_RETURN` | 9,5% a.a. | Desconto da escola e rendimento de referência quando a carteira não tem DY (§2.5) |
| `TUITIONS_PER_YEAR` | 13 | 12 meses + matrícula e material |
| `REINVESTMENT_SHARE` | 0,24 | A regra dos 24% (§2.7): a parte do que a meta recebe que volta para a carteira, e a inflação que o crescimento da acumulação desconta (§2.5) |

A taxa real de 0,4% a.m. dimensiona a meta (§2.3 e §2.4). O prazo, desde a revisão de 2026-11-07, usa o DY da carteira (§2.5). Não há tela para mudar as constantes.

### 2.2 Saúde por faixa etária (`health.ts`)

Mensalidade por pessoa, plano individual (PF), São Paulo, 2026: o ponto médio de cada faixa do levantamento do dono. O Premium de 39–43 é o R$ 850 da v2 (o ponto médio daria 840).

| Faixa | Básico | Conforto | Premium |
| --- | --- | --- | --- |
| 0–18 | 180 | 290 | 425 |
| 19–23 | 220 | 350 | 510 |
| 24–28 | 255 | 400 | 600 |
| 29–33 | 285 | 455 | 690 |
| 34–38 | 310 | 500 | 750 |
| 39–43 | 350 | 550 | 850 |
| 44–48 | 460 | 735 | 1.125 |
| 49–53 | 565 | 880 | 1.375 |
| 54–58 | 765 | 1.200 | 1.850 |
| 59+ | 1.085 | 1.725 | 2.850 |

"Sem plano (SUS)" vale 0 em todas as faixas.

- `healthCost(level, age)`: a mensalidade da faixa da idade.
- **`healthPerpetuity(level, age, r)`**: o capital, numa certa idade, que paga a tabela para sempre:

  ```text
  c(idade)/r + Σ (c(início da faixa) − c(faixa anterior)) / r × (1 + r)^(−12 × (início − idade))
  ```

  A soma passa pelas faixas que começam depois da idade. É o valor da faixa atual mais cada degrau como uma perpetuidade adiada.

### 2.3 Meta perpétua

```text
renda perpétua    = essencial + sazonais ÷ 12 + viagens ÷ 12
meta perpétua     = renda perpétua ÷ r
                  + healthPerpetuity(padrão, idade alvo, r)                      (titular)
                  + healthPerpetuity(padrão, idade do cônjuge na idade alvo, r)  (se houver)
```

A idade do cônjuge na idade alvo é a idade dele hoje + (idade alvo − idade atual).

### 2.4 Fundo temporário

São considerados os anos `k = 1, 2, …` contados a partir de hoje: no ano k, o mais novo tem `idade do mais novo + k − 1` anos. Um ano entra no fundo quando `k > T`, sendo `T = idade alvo − idade atual`, e enquanto o mais novo tiver menos que a idade de custeio (18 ou 24).

```text
escola(k)          = 13 × mensalidade × 1,08^(k − 1)                         (nominal)
fundo escola       = Σ escola(k) ÷ 1,095^k × (1 + r)^(12 × T)
saúde filhos(k)    = 12 × dependentes × healthCost(padrão, idade do mais novo no ano k)
fundo saúde filhos = Σ saúde filhos(k) ÷ ((1 + r)^12)^(k − T)
fundo temporário   = fundo escola + fundo saúde filhos
```

- Trazer a escola a valor presente hoje (÷ 1,095^k) e multiplicar por `(1 + r)^(12T)` dá o valor na idade alvo em reais de hoje: a mesma base da meta perpétua.
- A saúde dos filhos já está em reais de hoje e é descontada só pela taxa real.
- Sem dependentes, ou com a idade alvo depois do fim do custeio, o fundo é 0.

### 2.5 Total, progresso e prazo

```text
meta total = meta perpétua + fundo temporário
patrimônio = patrimônio do Koinos (snapshot Geral) + patrimônio externo informado
progresso  = patrimônio ÷ meta total
```

- **Aporte médio (PMT), o bolso:** é o `fromPocket` dos 12 meses fechados (`APORTE_MONTHS`, a média anual pedida pelo dono) menos as vendas em dinheiro, com piso 0 na média. Os proventos ficam de fora: o prazo os reinveste por inteiro, pelo DY.
- **Rendimento (`monthlyYieldOf`):** o DY de 12 meses da carteira (`dy12m` do snapshot Geral, a média ponderada dos ativos) ÷ 12. O DY é a soma de 12 distribuições mensais, e não um juro composto, então a divisão é simples. Sem DY (nulo, zero ou negativo), vale o rendimento de referência, 9,5% a.a. ÷ 12, e a tela diz que é de referência (`yieldSource`).
- **Crescimento na acumulação (`accumulationRate`):** na acumulação todo o DY é reinvestido, junto com o bolso. A parte que repõe a inflação, 24% do rendimento (a regra de §2.7), só mantém o valor da meta, que está em reais de hoje. O crescimento real do mês é, com `y` o rendimento mensal:

  ```text
  r_acumulação = (1 + y) ÷ (1 + 24% × y) − 1        (≈ 76% de y)
  ```

- **Prazo:** `monthsToTarget({ pv, fv, pmt, r })` com `r = r_acumulação` e os mesmos casos da v1. Ele dá o mês estimado (mês atual + n) e a idade prevista, `idade atual + ⌊n ÷ 12⌋`, exibida como "aos ~55 anos".
- **Comparação com a idade alvo:** são `m = 12 × T` meses até ela.
  - Prazo ≤ m: a folga é `m − n` meses.
  - Prazo > m, ou sem prazo: o aporte necessário (do bolso) é `PMT = (FV − PV·(1 + r)^m) × r ÷ ((1 + r)^m − 1)`, com piso 0, no mesmo `r = r_acumulação`.
  - T ≤ 0 (a idade alvo é hoje ou já passou): só o prazo, sem folga nem aporte necessário.

### 2.6 Exemplo (usado nos testes)

O cenário:

- titular de 40 anos, idade alvo 45, Conforto;
- essencial R$ 10.000/mês, sazonais R$ 12.000/ano, viagens R$ 24.000/ano;
- cônjuge de 38 anos;
- 2 dependentes, o mais novo com 6 anos, escola de R$ 2.500/mês até os 24.

| Parte | Valor |
| --- | --- |
| Renda perpétua ÷ r (R$ 13.000 ÷ 0,004) | R$ 3.250.000,00 |
| Saúde do titular (735 aos 45, degraus aos 49, 54 e 59) | R$ 332.777,82 |
| Saúde do cônjuge (550 aos 43, degraus aos 44, 49, 54 e 59) | R$ 316.999,00 |
| **Meta perpétua** | **R$ 3.899.776,83** |
| Fundo de escola (anos 6 a 18: o mais novo dos 11 aos 23) | R$ 421.812,65 |
| Saúde dos filhos (2 × a faixa do mais novo, nos mesmos anos) | R$ 70.007,47 |
| **Fundo temporário** | **R$ 491.820,11** |
| **Meta total** | **R$ 4.391.596,94** |

Com patrimônio de R$ 1.000.000 e PMT de R$ 8.000, e um crescimento real de 0,4% a.m. (o DY de ≈ 6,32% a.a. que dá exatamente esse crescimento, `V2_YIELD` nos testes), o prazo é de 190 meses (15 anos e 10 meses), aos ~55 anos. Para chegar aos 45 (60 meses), o aporte necessário seria de R$ 46.126,93/mês. Com o DY real da carteira o prazo muda (§2.5): é ele que entra na produção.

### 2.7 O que a meta recebe por mês: a regra dos 24% (pedido do dono, 2026-11-07)

No usufruto (depois de chegar na meta), a meta recebe por mês o rendimento da carteira sobre ela, e 24% do que recebe voltam para a carteira:

```text
recebe          = meta × y                       (y = o DY de 12 meses ÷ 12)
reinvestimento  = 24% × recebe                   (para cima no centavo, como a retenção da fruição)
para viver      = recebe − reinvestimento        (76%)
```

- É a mesma conta da retenção da fruição (`splitIncome`): as duas partes somam o recebido, e a retenção nunca fica abaixo dos 24%. A regra dos 24% é do dono e é independente do padrão de 25% da fruição.
- Os 24% são, no raciocínio do dono, o reinvestimento "para corrigir a inflação". Com o DY de 13,2% a.a., eles repõem uma inflação de ≈ 3,2% a.a. (24% × o DY). A v2 usava ≈ 4,4% a.a. (9,5% nominal sobre 0,4% real); o dono preferiu a regra dos 24%.
- Na acumulação a mesma regra aparece no crescimento (§2.5): o DY volta todo, e os 24% só mantêm o valor.
- A meta continua dimensionada a 0,4% a.m. real (§2.3 e §2.4). Com o DY atual, o que a meta recebe (e o que sobra para viver) é bem maior que a renda que o plano pede. Redimensionar a meta pelo DY e pelos 24% ficou como decisão do dono, ainda não tomada.
- `planTarget(plan)` é a meta total sem patrimônio nem prazo (as partes de §2.3 e §2.4). O questionário a usa para mostrar quanto cada resposta soma à meta (§3).

## 3. Questionário (7 passos + revisão)

| Passo | Campos | Validação |
| --- | --- | --- |
| 1. Perfil | Idade atual; idade alvo; patrimônio fora do Koinos (opcional, R$) | Atual 18–80; alvo da atual a 90; R$ 0 a `PLAN_AMOUNT_MAX` |
| 2. Custo de vida essencial | Gasto mensal fixo (moradia, contas, mercado, cartões) | R$ |
| 3. Bens e sazonalidades | Por ano: IPVA, IPTU, seguros, manutenção | R$ |
| 4. Família | Cônjuge no orçamento (sim/não, e a idade); dependentes (sim/não; quantos, de 1 a 10; idade do mais novo) | Cônjuge 18–90; mais novo 0–30 |
| 5. Educação (só com dependentes) | Custo mensal (sugestão R$ 2.500,00); custeio até 18 ou 24 anos (padrão 24) | R$; {18, 24} |
| 6. Plano de saúde | Sem plano, Básico, Conforto (padrão), Premium; cada opção mostra o valor da faixa do titular na idade alvo | Um dos quatro |
| 7. Estilo de vida | Viagens e lazer extra por ano | R$ |
| Revisão | A meta, o progresso, o prazo contra a idade alvo, o aporte necessário e a rentabilidade, calculados no cliente pelas mesmas funções puras; depois, a lista das respostas | |

- **Forma** (revisão de UX, §8): uma pergunta por vez, numa coluna de até 672 px, como os assistentes do macOS.
  - No topo, "Passo N de M · título" e a barra de passos em segmentos. A pergunta é o título do passo.
  - Os valores em R$ usam o `MoneyInput` grande (`size="lg"`).
  - As idades e a quantidade são linhas de número, e os sim/não são linhas com `SegmentedControl`, num grupo como os dos Ajustes do iOS. As escolhas usam `ChoiceList`, e a saúde mostra a mensalidade da faixa à direita.
- **Impacto:** nos passos de um valor (custo de vida, gastos do ano, educação, saúde e viagens), um quadro "Soma à meta" mostra quanto a resposta pesa. É a meta com ela menos a meta sem ela (`stepImpact`, por `planTarget`), refeito a cada tecla, com uma frase sobre a conta.
- **Teclado:** o Enter avança. Num campo que não é o último do passo, vai para o seguinte; numa opção, confirma o passo. A cada passo, o foco vai para o primeiro campo, ou para a opção marcada.
- **Revisão:** cada resposta é uma linha que leva ao seu passo, e o botão do passo ("Revisar") volta direto para a revisão. A exceção é a família que ganhou dependentes: ela passa antes pela educação (`nextStep`).
- **Editar uma meta salva:** o questionário abre na revisão, com "Cancelar". Os textos, a ordem, a navegação e as respostas são puros, em `components/wizard-steps.ts`.
- **Excluir a meta** (pedido do dono, 2026-11-07, para refazê-la por completo): a revisão de uma meta salva termina num botão vermelho "Excluir meta", com a confirmação em alerta (o foco cai em "Cancelar"). Apaga o plano e a página volta ao questionário do zero, com os padrões; a carteira, as transações e os proventos não mudam. A linha do Dashboard volta a "Definir meta".
- Sem dependentes, o passo 5 é pulado nos dois sentidos. A contagem "Passo N de M" acompanha.
- `PLAN_AMOUNT_MAX` continua R$ 1.000.000 para cada valor em R$. O patrimônio externo vai até R$ 100.000.000.

## 4. Dados

- O documento de `independence_plans` ganha `version: 2` e os campos:
  - `currentAge`, `targetAge`, `externalWealth`;
  - `essentialMonthly`, `seasonalYearly`, `travelYearly`;
  - `spouseAge` (null sem cônjuge);
  - `dependents` (0 sem) e `youngestAge` (null sem);
  - `educationMonthly` e `educationUntil` (18 ou 24);
  - `healthLevel` (`nenhum`, `basico`, `conforto` ou `premium`).
- **Plano v1** (sem `version`): o repo devolve `{ plan: null, draft }`. O rascunho preenche o questionário com:
  - essencial = `livingCost`;
  - viagens = `travelPerYear`;
  - `healthLevel` = `answers.health`;
  - o resto com os padrões.
  A página avisa "A meta ganhou novas perguntas: confira e salve." e a linha do Dashboard diz "Atualizar meta".
- A action `saveIndependencePlanAction` valida com o novo Zod e grava `version: 2` substituindo o documento inteiro (`replaceOne` com upsert). Assim, os campos da v1 somem.
- A action `deleteIndependencePlanAction` apaga o documento da carteira (`deleteOne` pelo `portfolioId`) e não recebe entrada. Sem plano e sem documento da v1, a página abre o questionário em branco.

## 5. Página

Três cards na largura toda, cada um dividido em colunas por container query (revisão de UX, §8):

- **`TargetCard`:**
  - à esquerda, o montante necessário em Large Title, a barra de progresso, a % com o patrimônio, o que falta (ou "Acima da meta") e, com patrimônio externo, a soma Koinos + fora;
  - à direita, o que a meta recebe por mês (§2.7), com a taxa mensal: a barra dividida (reinvestimento de 24% em `--chart-1`, como os aportes; "para viver", 76%, em `--chart-2`, como os proventos), as duas partes e a frase de onde vem o rendimento (o DY dos ativos ou o de referência) e do que os 24% repõem.
- **`ForecastCard`:**
  - à esquerda, "Aos ~55 anos", o selo da diferença para a idade alvo (verde antes ou na idade, âmbar depois; `forecastVerdict`) e o mês;
  - à direita, o aporte do bolso de hoje contra o necessário para parar na idade alvo, com um medidor, e a nota: a média dos 12 meses fechados, o DY todo reinvestido junto e o crescimento real por mês (§2.5).
- **`TargetBreakdown`:**
  - a barra perpétua × temporária (só com fundo temporário);
  - três grupos com subtotal: custo de vida, meta perpétua e fundo temporário;
  - o total.
  - A rosca e o Recharts saíram desta página.
- **"Editar meta"** no cabeçalho na mesa e no botão ao lado da tab bar no iPhone (`EditPlanButton`). Só aparece com meta salva. Abre o questionário na revisão, e ao sair o foco volta para ele. Substitui o "Refazer questionário" do fim da página.
- **Faixa do Dashboard** (escolha do dono, 2026-11-07, entre uma linha com os números, a faixa e um card): sem card, em tipo pequeno, acima do filtro de classe. No alto, "Independência financeira" e a %; embaixo da barra, em três colunas, **Montante** (a meta), **Rende/mês** (o que ela recebe) e **Reinveste** (os 24%), em `formatCompactBRL`. Cabe em três colunas no iPhone, tem 80 px de altura (o esqueleto do Dashboard tem a mesma) e a faixa inteira é o link. Sem meta, volta a uma linha com "Definir meta" ou "Atualizar meta". A previsão ("aos ~55") saiu da faixa: fica na página.
- Todo R$ fica sob `Sensitive`, inclusive os da revisão do questionário.

## 6. Fora do escopo

- A idade de cada filho separada.
- A inflação própria da saúde (VCMH acima do IPCA).
- As constantes editáveis e o simulador de cenários.
- A fruição continua nos motores, mas não entra mais nesta feature.

## 7. Testes

- **`health.test.ts`:**
  - cada faixa nos limites (18/19, 43/44, 58/59) e 0 sem plano;
  - a perpetuidade sem degraus aos 59 (= c ÷ r);
  - o titular do exemplo (R$ 332.777,82).
- **`plan.test.ts`:**
  - o exemplo de §2.6 parte a parte;
  - o fundo zero sem dependentes e com a idade alvo depois do custeio;
  - o custeio até 18 contra 24;
  - patrimônio externo somado;
  - `monthsToTarget` (os casos da v1);
  - aporte necessário (exemplo, piso 0 quando PV já cresce até a meta, T ≤ 0 sem comparação);
  - a folga;
  - a idade prevista;
  - `planTarget` igual à meta do resumo;
  - o rendimento (`monthlyYieldOf`: o DY ÷ 12, e a referência sem DY, com nulo, zero, negativo e NaN) e de onde ele veio no resumo;
  - `accumulationRate` (≈ 76% do rendimento) e o `V2_YIELD`, o DY que reproduz os 0,4% a.m. reais e, com ele, os números do exemplo (190 meses, R$ 46.126,93);
  - o prazo com o DY igual à simulação mês a mês, DY maior com prazo menor e o aporte necessário que leva à meta;
  - o que a meta recebe por mês (R$ 43.915,97 = 10.539,84 + 33.376,13 com DY de 12%), os 24% para cima no centavo, as partes somando o total e a meta zero sem -0.
- **`migrate.test.ts`:** um plano v1 vira o rascunho com os três campos e os padrões.
- **`aporte.test.ts`:** a janela passa a 12 meses fechados (`APORTE_MONTHS`); o resto, sem mudança.
- **`catalog.test.ts`:** passa a cobrir os padrões do rascunho e os níveis de saúde.
- **`components/format.test.ts`:** o selo da previsão (depois, antes, na idade alvo, meta alcançada, sem previsão, idade alvo hoje), o título do prazo, `yieldLabel` (o DY dos ativos ou o de referência) e `monthSlash`.
- **`components/wizard-steps.test.ts`:**
  - os passos com e sem educação e `nextStep`/`previousStep`, na ordem e vindo da revisão (direto para ela, ou pela educação quando a família ganhou dependentes);
  - `stepImpact` no exemplo (R$ 2.500.000 do custo de vida, a escola e a saúde de §2.6, zero sem plano, null sem um valor só);
  - as respostas da revisão, com o R$ separado do texto.

## 8. Revisão de UX (2026-11-07)

Pedido do dono: revisar o layout e a usabilidade da página, do questionário e da linha do Dashboard, com o olhar dos apps da Apple. No meio da revisão, ele pediu mais destaque para o montante, a rentabilidade mensal e o reinvestimento contra a inflação (§2.7).

| O que a prévia mostrou | Decisão |
| --- | --- |
| A meta total aparecia duas vezes em letra grande (card de progresso e rosca) | Uma vez só, no `TargetCard`, ao lado da rentabilidade mensal |
| A previsão (aos ~55) não se comparava com a idade alvo (45), e o aporte necessário ficava escondido numa linha | O selo "10 anos e 10 meses depois dos 45" e o aporte de hoje contra o necessário, com medidor |
| A rosca tinha só duas partes, com nomes que mudavam ("caixa", "meta", "fundo") | Uma barra dividida e os mesmos nomes em toda a página: meta perpétua e fundo temporário |
| A conta era uma lista de 10 linhas com rótulos longos; na mesa, rótulo e valor ficavam a ~1.100 px de distância | Três grupos com subtotal, lado a lado na mesa; os cards se dividem em colunas por container query |
| "Refazer questionário" no fim da página, e mudar um valor exigia os 7 passos | "Editar meta" no cabeçalho (e na tab bar), abrindo na revisão; cada resposta leva ao seu passo e volta |
| O questionário era um card de ~1.100 px com campos pequenos, sem barra de progresso; os dois sim/não tinham formatos diferentes; o resumo não mostrava as respostas | Coluna de 672 px, barra de passos, valor grande com o impacto na meta, Enter avançando, os sim/não no mesmo grupo de linhas e a revisão com as respostas |
| A linha do Dashboard dizia o prazo por extenso ("≈ 15 anos e 10 meses, aos ~55") | "22,8% de R$ 4,4 mi · aos ~55": o progresso, o tamanho da meta e a idade |

## 9. Rendimento pelo DY e a regra dos 24% (2026-11-07)

Depois de ver a página no ar, o dono perguntou se a rentabilidade usava o DY atual dos investimentos e se esse retorno era reinvestido junto com o aporte do bolso, e pediu a regra de 24% do montante recebido para o reinvestimento. A resposta era não: a v2 usava os 0,4% a.m. reais fixos, e o DY só entrava no aporte do bolso (os proventos reinvestidos saem dele). Ele definiu o modelo:

| Pedido do dono | O que ficou |
| --- | --- |
| "No prazo de acumulação, todo DY é reinvestido" | O crescimento do prazo vem do DY de 12 meses da carteira, todo reinvestido (§2.5) |
| "Considerar o aporte DY + bolso" | DY reinvestido + aporte do bolso, o prazo e o aporte necessário no mesmo crescimento |
| "O bolso, com a média anual de aportes do bolso, ou os últimos 6 meses" | Média de 12 meses (`APORTE_MONTHS`). Com os dados do dono: R$ 4.553,90 contra R$ 4.043,99 em 6 meses, 141 contra 145 meses de prazo |
| "A regra de 24% do montante recebido para o reinvestimento" | No usufruto, 24% do que a meta recebe voltam para a carteira e 76% são para viver (§2.7) |

Decisões minhas, para o dono revisar:

- Os 24% também fixam a inflação do crescimento da acumulação (24% do DY), para a conta seguir em reais de hoje; sem isso o prazo contaria a inflação como crescimento.
- O DY ÷ 12 é o rendimento mensal (a soma de 12 distribuições mensais), e não o juro composto equivalente.
- A meta não foi redimensionada: continua a 0,4% a.m. real.

Efeito com os dados do dono (DY de 13,18% a.a.): o prazo foi de 244 meses (aos 57) para 141 (aos 48), e o aporte necessário para parar aos 45, de R$ 22.265 para R$ 13.725. É um cenário mais otimista: o DY é só a renda em dinheiro, e a carteira vale 12,5% menos do que foi paga.
