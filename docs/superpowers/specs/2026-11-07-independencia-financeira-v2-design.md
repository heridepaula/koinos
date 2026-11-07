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
| `NOMINAL_ANNUAL_RETURN` | 9,5% a.a. | Desconto da escola |
| `TUITIONS_PER_YEAR` | 13 | 12 meses + matrícula e material |

Juntas, 9,5% nominal e 0,4% a.m. real implicam um IPCA de ≈ 4,38% a.a. Não há tela para mudar as constantes.

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

- **Aporte médio (PMT):** como na v1 (§2.4 dela). É o `fromPocket` dos 6 meses fechados menos as vendas em dinheiro, com piso 0 na média.
- **Prazo:** `monthsToTarget({ pv, fv, pmt, r })` com `r = REAL_MONTHLY_RATE` e os mesmos casos da v1. Ele dá o mês estimado (mês atual + n) e a idade prevista, `idade atual + ⌊n ÷ 12⌋`, exibida como "aos ~55 anos".
- **Comparação com a idade alvo:** são `m = 12 × T` meses até ela.
  - Prazo ≤ m: a folga é `m − n` meses.
  - Prazo > m, ou sem prazo: o aporte necessário é `PMT = (FV − PV·(1 + r)^m) × r ÷ ((1 + r)^m − 1)`, com piso 0.
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

Com patrimônio de R$ 1.000.000 e PMT de R$ 8.000, o prazo é de 190 meses (15 anos e 10 meses), aos ~55 anos. Para chegar aos 45 (60 meses), o aporte necessário seria de R$ 46.126,93/mês.

## 3. Questionário (7 passos + resumo)

| Passo | Campos | Validação |
| --- | --- | --- |
| 1. Perfil | Idade atual; idade alvo; patrimônio fora do Koinos (opcional, R$) | Atual 18–80; alvo da atual a 90; R$ 0 a `PLAN_AMOUNT_MAX` |
| 2. Custo de vida essencial | Gasto mensal fixo (moradia, contas, mercado, cartões) | R$ |
| 3. Bens e sazonalidades | Por ano: IPVA, IPTU, seguros, manutenção | R$ |
| 4. Família | Cônjuge no orçamento (sim/não, e a idade); dependentes (sim/não; quantos, de 1 a 10; idade do mais novo) | Cônjuge 18–90; mais novo 0–30 |
| 5. Educação (só com dependentes) | Custo mensal (sugestão R$ 2.500,00); custeio até 18 ou 24 anos (padrão 24) | R$; {18, 24} |
| 6. Plano de saúde | Sem plano, Básico, Conforto (padrão), Premium; cada opção mostra o valor da faixa do titular na idade alvo | Um dos quatro |
| 7. Estilo de vida | Viagens e lazer extra por ano | R$ |
| Resumo | Meta perpétua, fundo temporário, total e prazo, calculados no cliente pelas mesmas funções puras | |

- Os valores em R$ usam `MoneyInput`, as idades e a quantidade usam campos numéricos, os sim/não usam `SegmentedControl` e as escolhas usam `ChoiceList`.
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

## 5. Página

- **Meta em destaque:** a meta total em Title 1, a barra, o patrimônio (Koinos + externo), a % e o que falta.
- **Perpétua × temporária:** rosca com as duas partes, em Recharts via `next/dynamic` (`ssr: false`) e `ChartPlaceholder` da mesma altura. As séries usam `--chart-1` e `--chart-2`, com legenda. O fundo temporário zero mostra só a perpétua.
- **Prazo:**
  - a idade e o mês previstos;
  - a folga ("12 meses antes da idade alvo") ou o aporte necessário ("Para chegar aos 45: R$ 46.126,93/mês");
  - o aporte médio do bolso;
  - a taxa real.
- **Conta linha a linha:**
  - renda perpétua (os três itens) e o ÷ r;
  - saúde do titular e do cônjuge, com o valor de hoje da faixa e os degraus;
  - escola e saúde dos filhos;
  - patrimônio externo.
- **"Refazer questionário"** como na v1.
- **Linha do Dashboard:** a mesma, com o prazo "≈ 15 anos e 10 meses, aos ~55".
- Todo R$ fica sob `Sensitive`.

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
  - a idade prevista.
- **`migrate.test.ts`:** um plano v1 vira o rascunho com os três campos e os padrões.
- **`aporte.test.ts`:** sem mudança.
- **`catalog.test.ts`:** passa a cobrir os padrões do rascunho e os níveis de saúde.
