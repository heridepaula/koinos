# Aporte entre FIIs e ações: especificação de design

- **Data:** 2026-10-31
- **Status:** aprovado e implementado (branch feat/aporte-por-classe)
- **Origem:** Fase 3 do plano colado pelo dono em 2026-10-31 ("motor de sugestões e aportes"), depois da Carteira Alvo de ações (`2026-10-31-carteira-alvo-acoes-design.md`).
- **Muda uma regra de 2026-10-31:** "as Recomendações são só de FIIs" passa a "as Recomendações dividem o aporte entre as duas carteiras pela meta por classe".

## 1. Objetivo

Recomendar o aporte nas duas carteiras: o valor é dividido entre FIIs e ações por uma meta de alocação entre as classes, e cada carteira roda a sua cascata. A cascata de FIIs continua a do motor 3.0.

### Critérios de sucesso

1. Com a meta em 100% FIIs (ou sem meta salva), as ordens são idênticas às de hoje para qualquer valor.
2. Com a meta salva, a divisão leva cada classe para perto da meta só com dinheiro novo, e a soma das partes é o aporte.
3. Nenhuma ação recebe mais de 25% da parte das ações; não há limite de setor nem de macro nas ações.
4. O troco das ações compra FIIs, e o troco dos FIIs volta para as ações; gasto + troco final = aporte.
5. A tela mostra a divisão, as ordens por carteira e o troco final; o "Por quê" da ação não cita P/VP nem vacância.
6. Os testes novos (§8) passam, e os de hoje continuam passando.

## 2. O que mudou em relação ao plano de origem

| Plano de origem | Decisão | Motivo |
| --- | --- | --- |
| Checkboxes para escolher as carteiras do aporte | As duas carteiras sempre entram, pela meta | Escolha do dono: meta por classe |
| % do aporte digitada a cada vez (ex.: 60/40) | Meta de alocação salva, aplicada ao patrimônio | Escolha do dono. O método Suno já rebalanceia só com dinheiro novo |
| A cascata roda no backend duas vezes | Roda no navegador, como hoje, até três vezes (troco cruzado) | A calculadora já é do cliente (`AporteCalculator`) |
| O troco de cada carteira fica parado | O troco passa para a outra carteira | Escolha do dono |

## 3. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Divisão | Meta por classe (% de FIIs; ações = o resto), sobre o patrimônio de cada classe | Escolha do dono |
| Limites das ações | 25% por ação, sem setor nem macro | Escolha do dono. O app não tem setor de ações |
| Troco | Passa para a outra carteira | Escolha do dono |
| Motor | Abordagem A: dividir e rodar uma cascata por carteira | Escolha do dono. A cascata de FIIs fica intacta |
| Meta | Coleção `class_targets`, editada na Carteira Alvo | Escolha do dono |

## 4. Regras (código puro, `smart-buy/domain`)

### 4.1 Meta por classe

- `ClassTarget = { fiiPercent: number }`, inteiro de 0 a 100. A meta das ações é `100 − fiiPercent`.
- Sem meta salva, vale `fiiPercent = 100`: tudo vai para FIIs, como antes.

### 4.2 Divisão (`splitByClassTarget`, `class-split.ts`)

Entrada: o aporte, a meta, o patrimônio de cada classe e se cada classe pode receber.

- **Patrimônio da classe:** o valor de todas as posições abertas dela (preço atual × quantidade, ou o preço médio sem cotação), inclusive as em quarentena ou fora da estratégia, como em "80% do patrimônio".
- **Pode receber:** a meta da classe é maior que 0% e ela tem ao menos um ativo na estratégia com rank, teto e preço. Se uma classe não pode, a parte inteira vai para a outra. Se nenhuma pode, as duas partes são zero. Uma classe com meta 0% nunca recebe, nem troco.
- **Pedido:** meta da classe = % × (patrimônio das duas + aporte); pedido = max(0, meta − patrimônio).
- **Divisão:**
  - pedidos somando mais que o aporte: o aporte é dividido na proporção dos pedidos;
  - pedidos somando menos: cada classe recebe o pedido, e o resto vai pela própria % (com a classe que não pode receber fora);
  - as partes são em centavos (arredondadas para baixo, a diferença vai para a classe com o maior pedido), e a soma é o aporte.
- Saída: `{ FII: { asked, share }, ACAO: { asked, share } }`.

### 4.3 Cascata com limites por carteira

- `sunoCascade(amount, assets, caps = RISK_CAPS)`: o parâmetro novo é opcional, então FIIs não mudam.
- `STOCK_CAPS = { asset: 0.25, sector: Infinity, macro: Infinity }`.
- A ação entra como `CascadeAsset` com `priceToBook: null`, `vacancy: null`, `macro: "Outros"`, `sector: null`: os tensores de valuation e vacância ficam em 1; agem a margem até o teto e o freio de dividendos (último provento ÷ a média de 12 meses, do Yahoo). Sem histórico de proventos, o freio fica em 1.

### 4.4 Aporte combinado (`classAporte`, `class-aporte.ts`)

1. Divide o aporte pela meta (§4.2).
2. Roda as ações com a parte delas (`STOCK_CAPS`).
3. Roda os FIIs com a parte deles + o troco das ações (`RISK_CAPS`), se os FIIs podem receber; senão, o troco das ações fica no troco final.
4. Se o troco dos FIIs é maior que zero e as ações podem receber, roda as ações de novo com o que elas gastaram no passo 2 + o troco dos FIIs (o troco delas já foi para os FIIs, então não entra de novo). Essa rodada substitui a do passo 2 só se gastar mais.
5. O troco final é aporte − gasto nas duas carteiras.

Os limites de 25% são sobre a parte final de cada classe (a da rodada que vale). Saída: `{ split, fii: CascadeResult, stock: CascadeResult, leftover }`.

Com `fiiPercent = 100` e as ações sem parte, o resultado dos FIIs é exatamente `sunoCascade(aporte, cascadeInput)`.

### 4.5 Snapshot

- `stockCascadeInput`: a estratégia de ações vira `CascadeAsset[]` com as mesmas regras da de FIIs (rank, teto, peso efetivo, preço, posição, proventos do Yahoo), com os campos de §4.3.
- `classValues: { FII: number; ACAO: number }`: o patrimônio de cada classe (§4.2), calculado na visão Geral.
- `cascadeInput` não muda.

## 5. Meta: dados e ações do servidor

- **Coleção `class_targets`** (`strategy/server/class-target.model.ts`): `portfolioId` (único), `fiiPercent` (inteiro, 0 a 100), timestamps.
- **Repositório** (`strategy/server/class-target-repo.ts`) com `portfolioId` explícito; **DAL** `getMyClassTarget()` (React `cache`, pelo tenant) em `strategy/server.ts`, devolvendo `ClassTarget | null`.
- **Ação** `setClassTargetAction` (`strategy/actions.ts`, `authActionClient`, `actionName: "setClassTarget"`): Zod `{ fiiPercent: z.number().int().min(0).max(100) }`, upsert, `refresh()`. `fiiPercent` não entra em `TRACEABLE_INPUT_FIELDS` (valor da carteira).

## 6. Telas

### 6.1 Carteira Alvo

- Painel "Meta entre classes" acima da tabela, nas duas abas:
  - o campo da % de FIIs (salva ao sair, como os campos da tabela) e a % de ações calculada;
  - a alocação atual de cada classe (% do patrimônio das duas);
  - sem meta salva: "Sem meta: o aporte vai todo para FIIs."
- No celular, o painel é uma célula do `InsetGroup` que abre uma folha com o campo.
- A linha "As Recomendações ainda são só de FIIs." da aba Ações sai.

### 6.2 Recomendações (`/recomendacoes?valor=`)

- A página passa à `AporteCalculator`: `cascadeInput`, `stockCascadeInput`, a meta (ou null), `classValues`.
- **Divisão:** acima das ordens, "FIIs R$ X · Ações R$ Y", com a meta e a alocação atual ("Ações em 3% contra a meta de 20%"). Quando o troco passou de uma carteira para a outra, uma linha diz quanto.
- **Ordens:** dois grupos, "FIIs" e "Ações", cada um com as suas ordens e exclusões; a soma geral e o troco final embaixo.
- **"Por quê" da ação** (`explain.ts`): rank, distância até a meta da carteira de ações, margem até o teto e o freio de dividendos quando age; sem P/VP e sem vacância. O limite que cortou fala "25% da parte das ações".
- **Sem meta salva:** um aviso com link para a Carteira Alvo ("Defina a meta entre FIIs e ações"); a divisão usa 100% FIIs.
- `?valor=` continua sendo o único parâmetro.

## 7. Erros e limites

- Ação sem cotação ou sem teto fica de fora com o motivo de sempre (`EXCLUSION_LABELS`).
- O JCP do Yahoo é bruto: o freio de dividendos da ação compara bruto com bruto, então a razão continua válida.
- A meta é uma por portfólio; não há meta por período.
- O patrimônio da classe usa o preço médio quando falta cotação, como o resto do app.

## 8. Testes

Vitest, só no código puro:

- `smart-buy/domain/class-split.test.ts`: as duas classes abaixo da meta; uma acima; as duas acima; uma classe sem estratégia; a soma das partes é o aporte, em centavos.
- `smart-buy/domain/suno-cascade.test.ts`: com `STOCK_CAPS`, um ativo passa de 35% sem setor e o macro não limita; sem o parâmetro, os resultados de hoje (os cenários A, B e C e as invariantes) não mudam.
- `smart-buy/domain/class-aporte.test.ts`: o troco das ações compra FIIs; o troco dos FIIs volta para as ações; gasto + troco = aporte; com `fiiPercent = 100`, igual a `sunoCascade` só de FIIs; invariantes em carteiras aleatórias com semente (nenhuma ação passa de 25% da parte final).
- `smart-buy/components/aporte/explain.test.ts`: o "Por quê" da ação.
- `portfolio/domain/snapshot.test.ts`: `stockCascadeInput` só com ações da estratégia; `classValues` soma o patrimônio.

Verificação: `format:check`, `lint`, `typecheck`, `test` e `build`. Depois, um script só de leitura com os dados reais imprime a divisão e as ordens para R$ 10.000 com a meta em 100% (igual à `main`) e em 80%.

## 9. Documentação

- **CLAUDE.md:** Domain flow item 3 (divisão, cascata de ações, troco cruzado), Pages (`/recomendacoes`, `/carteira-alvo` com a meta), Product rules (aporte), Asset class (ações nas Recomendações), Tests.
- **Spec da Carteira Alvo de ações:** nota apontando para este spec.

## 10. Fora do escopo

- Setor das ações e limite por setor nas ações.
- P/VP ou outro valuation de ações.
- Mais de duas classes, carteiras com nome.
- Venda para rebalancear (o método só usa dinheiro novo).
