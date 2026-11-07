# Independência financeira: meta, progresso e prazo

Data: 2026-11-07. Origem: a proposta de "Acompanhamento de Independência Financeira (FIRE)" que o dono colou no mesmo dia, ajustada às regras que o Koinos já tem e aprovada por ele no brainstorming.

## 1. O que a proposta pedia e o que mudou

| Proposta | Decisão | Por quê |
| --- | --- | --- |
| Questionário de 5 perguntas com faixas que viram R$ por uma tabela escondida | Cada resposta preenche um R$ sugerido, editável antes de salvar; o plano guarda os R$ | A proposta só trazia alguns valores (Plano Conforto R$ 800/pessoa, viagem internacional R$ 24.000/ano) |
| Reinvestimento de 10%, 20% ou 30% (padrão 20%) | 20%, 25% (padrão) ou 30% | A fruição (`2026-11-01-fruicao-design.md`) já fixa o piso em 20% (`MIN_RETENTION`) e o padrão em 25% (`DEFAULT_RETENTION`); `fruition()` recusa menos |
| Yield da carteira "corrente", fallback 0,6% a.m. | Média recebida nos 12 meses fechados ÷ patrimônio de hoje (Geral) | Dado real das extrações da B3, menos ruidoso que a renda estimada de um mês |
| Taxa real = yield "descontado da inflação esperada" | `r = yield × (1 − retenção)` | O Koinos não tem IPCA (o SGS ficou para depois). Na própria meta, a retenção é o que repõe a inflação, então o resto do yield é o ganho real |
| Aporte médio = depósitos dos últimos 6 meses | Média do dinheiro do bolso nos 6 meses fechados, menos as vendas | Os proventos já entram pelo `r`; somá-los ao PMT os contaria duas vezes |
| `POST/GET /api/fire-plan`, `progress` do Radix, `/dashboard/independencia/setup` | Server Action + DAL, Base UI, página de topo `/independencia` | Padrão do projeto (CLAUDE.md, Architecture) |
| Barra fixa no Dashboard com tooltip | Card mínimo no Dashboard (%, barra, prazo) que leva à página; os detalhes ficam na página | Pedido do dono: "o card no dashboard deve ser o mais simples possível" |

## 2. Regra (`src/features/independence/domain/`, pura)

### 2.1 Catálogo (`catalog.ts`)

Cada pergunta tem opções de escolha única, cada uma com um valor sugerido. O padrão vem marcado. Os valores são sugestões, e o dono ajusta o R$ de cada item no questionário.

| Passo | Pergunta | Opções (R$ sugerido) | Padrão |
| --- | --- | --- | --- |
| 1 | Custo de vida mensal da casa (moradia, alimentação, contas, lazer, cartão) | Vida frugal, R$ 3.000–5.000 (4.000); Conforto básico, R$ 5.000–10.000 (7.500); Padrão elevado, R$ 10.000–15.000 (12.500); Alto padrão, acima de R$ 15.000 (20.000) | Conforto básico |
| 2 | Quantas pessoas no orçamento | Só eu (1); Eu e cônjuge (2); Casal + 1 filho (3); Casal + 2 ou mais filhos (4) | Só eu |
| 3 | Plano de saúde, por pessoa e por mês | Não preciso (0); Básico, enfermaria regional (400); Conforto, apartamento nacional (800); Premium, hospitais de ponta (2.000) | Conforto |
| 4 | Viagens de lazer por ano (valor anual da casa) | 1 nacional (6.000); 2 nacionais ou 1 internacional modesta (15.000); 1 a 2 internacionais de alto padrão (36.000) | 2 nacionais ou 1 internacional |
| 5 | Quanto dos proventos reinvestir todo mês | 20%; 25%; 30% | 25% |

- O passo 1 já é o custo da casa toda. O número de pessoas (passo 2) só multiplica a saúde.
- O passo 2 não tem R$: a quantidade de pessoas é editável de 1 a 10.
- O passo 5 não tem R$. As opções saem de `MIN_RETENTION` e `DEFAULT_RETENTION` (importados de `smart-buy`), e não existe opção abaixo de 20%.

### 2.2 Meta (`plan.ts`)

```text
necessidade (líquida) = custo de vida + saúde por pessoa × pessoas + viagens por ano ÷ 12
renda bruta          = necessidade ÷ (1 − retenção)
yield mensal         = (proventos recebidos nos 12 meses fechados ÷ 12) ÷ patrimônio
meta                 = renda bruta ÷ yield mensal
progresso            = patrimônio ÷ meta
```

- **Yield:** vem de `dividendPace` (os 12 meses fechados) e do patrimônio do snapshot Geral, com FIIs e ações. Quando o patrimônio é zero, quando não há proventos ou quando o resultado sai da faixa de 0,2% a 1,5% a.m. (`YIELD_BOUNDS`), o cálculo usa `DEFAULT_MONTHLY_YIELD` = 0,6% a.m. A fonte é devolvida junto (`"carteira"` ou `"padrao"`) e aparece na tela.
- **Progresso:** o valor guardado é o real e pode passar de 1. A barra para em 100%.
- Valores em R$ com 2 casas no fim (a meta arredonda para o centavo). Não há correção da meta pela inflação ao longo do tempo: tudo é em reais de hoje.

Exemplo (com a retenção de 20%, que é válida): necessidade R$ 10.000 → bruta R$ 12.500 → com yield de 0,7% a.m., meta **R$ 1.785.714,29**.

### 2.3 Prazo (`monthsToTarget`)

```text
r   = yield mensal × (1 − retenção)
n   = ln((FV·r + PMT) ÷ (PV·r + PMT)) ÷ ln(1 + r)      (meses)
```

FV é a meta, PV o patrimônio e PMT o aporte médio do bolso (2.4). Note que FV·r é a própria necessidade líquida.

- `PV ≥ FV`: prazo 0, meta alcançada.
- `r = 0`, com `PMT > 0`: `n = (FV − PV) ÷ PMT`.
- `PV·r + PMT ≤ 0`, ou `r = 0` com `PMT = 0`: o resultado é `null`, e a tela diz "sem prazo nesse ritmo".
- `n` é arredondado para cima, em meses inteiros. A data estimada é o mês atual (São Paulo) mais `n`, e a tela a mostra como "Y anos e Z meses (mm/aaaa)".

Exemplo: PV R$ 500.000, FV R$ 1.785.714,29, PMT R$ 5.000, yield 0,7% e retenção 20% → r = 0,56% a.m. → n = 117,1 → **118 meses (9 anos e 10 meses)**.

### 2.4 Aporte médio (PMT)

- São os 6 meses fechados antes do mês atual, em São Paulo.
- Cada mês vale o `fromPocket` de `reinvestmentHistory` (`portfolio/domain/reinvestment.ts`): as compras em dinheiro (negócios e subscrições, com taxas) menos a parte que saiu dos proventos, pela % reinvestida do mês. Daí se tiram as vendas em dinheiro do mês: negócios e leilões de fração, quantidade × preço menos taxas. A saída de incorporação não conta.
- Um mês sem compras vale 0 (menos as vendas, se houver).
- PMT = a média dos 6 meses, com piso 0 só na média: um mês negativo abate os outros.

## 3. Dados e servidor

- Coleção `independence_plans` (`independence/server/plan.model.ts`), com um documento por `portfolioId` (índice único):
  - `answers`: a chave da opção escolhida em cada passo, para reabrir o questionário no mesmo lugar;
  - `livingCost`, `people`, `healthPerPerson`, `travelPerYear` e `retention`: os valores finais;
  - `updatedAt`.
- `saveIndependencePlanAction` (`independence/actions.ts`):
  - roda em `authActionClient`, com `.metadata({ actionName: "saveIndependencePlan" })`;
  - valida com Zod: R$ de 0 a `PLAN_AMOUNT_MAX` (R$ 1.000.000) com 2 casas, pessoas de 1 a 10 inteiras, retenção em {0,20; 0,25; 0,30} e as chaves do catálogo;
  - faz upsert pelo portfólio do tenant e chama `refresh()` no fim;
  - nenhum campo novo entra em `TRACEABLE_INPUT_FIELDS`.
- `getIndependenceView()` (`independence/server.ts`, com React `cache`, span `view.independence` e atributo `koinos.independence.has_plan`):
  - lê o plano, o snapshot Geral (patrimônio e `dividendPace`) e os dados de `reinvestmentHistory` (ledger, proventos, % por mês);
  - devolve um DTO sem ids: o plano (ou `null`), a necessidade, a renda bruta, o yield com a fonte, a meta, o progresso, o PMT, `r`, os meses e a data estimada;
  - passa por `getTenant`.

## 4. Interface

- **`/independencia`** (`src/app/(app)/independencia/page.tsx`):
  - Entra em `nav-items.ts`, sem `tab` (no iPhone fica no "Mais"), e o `proxy.ts` ganha o matcher `/independencia/:path*`.
  - O header é estático e a seção vem em `<Suspense>`.
  - **Sem plano:** a página abre o `IndependenceWizard` (client), com um passo por vez:
    - cada passo tem cartões de escolha única (radio group, com setas no teclado e 44 px no toque) e, abaixo, o `MoneyInput` com o valor da opção, editável (pessoas num campo numérico);
    - os botões são Voltar e Avançar, e o último passo é um resumo com a necessidade, a bruta e a meta calculadas no cliente pelas mesmas funções puras, antes do Salvar.
  - **Com plano**, três cards:
    1. **Progresso:** a barra (o patrimônio contra a meta) e a %.
    2. **Como chegamos na meta:** linhas com custo de vida, saúde (por pessoa × pessoas), viagens ÷ 12, necessidade, retenção, renda bruta, yield (com "da carteira, 12 meses" ou "padrão de 0,6% a.m."), meta.
    3. **Prazo:** "No ritmo atual (R$ X/mês do seu bolso, média de 6 meses), você chega à meta em Y anos e Z meses (mm/aaaa)", com o `r` usado e a nota de que os proventos já estão no `r`. Com prazo 0: "Meta alcançada". Com `null`: "Sem prazo nesse ritmo".
  - Botão "Refazer questionário": reabre o wizard preenchido com o plano salvo.
- **Card no Dashboard** (`IndependenceCard`, em `<Suspense>` próprio):
  - Com plano, é o mais simples possível: o título "Independência financeira", a % e a barra, mais uma linha "≈ Y anos (aaaa)", "Meta alcançada" ou "Sem prazo nesse ritmo".
  - O card inteiro é um link para `/independencia`.
  - Sem plano, mostra uma linha, "Definir meta →", com o mesmo link.
- Todo R$ fica sob `Sensitive`. A barra usa `role="progressbar"` com `aria-valuenow`.

## 5. Fora do escopo

- A meta corrigida pela inflação ao longo do tempo.
- Simulador de cenários (outro PMT, outro yield).
- Alertas no sino.
- Ligar o plano à fase de fruição dos motores: a fase continua sem tela, como diz a spec da fruição.
- Planos por classe: a meta é sempre a carteira Geral.

## 6. Testes

- `independence/domain/plan.test.ts`:
  - a necessidade soma os três itens com a saúde × pessoas;
  - a bruta com cada retenção;
  - o exemplo de 2.2 (R$ 1.785.714,29);
  - o yield da carteira, e o padrão com patrimônio 0, sem proventos e fora da faixa, nos dois lados;
  - o progresso acima de 1 preservado.
- `monthsToTarget`: o exemplo de 2.3 (118), PV ≥ FV dá 0, `r = 0` com PMT, `r = 0` sem PMT dá `null`, PMT 0 com `r > 0`, e a data estimada com a virada de ano.
- PMT: mês sem compras conta 0, vendas abatem, um mês negativo abate a média, piso 0 na média, só os 6 meses fechados (o mês atual fora).
- `catalog.test.ts`: cada passo tem um padrão, as retenções ficam em `MIN_RETENTION` ou acima, e o padrão da retenção é `DEFAULT_RETENTION`.
