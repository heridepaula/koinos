# Koinos: especificação de design (MVP)

- **Data:** 2026-10-17
- **Status:** design aprovado na conversa; este documento aguarda revisão
- **Ciclo:** Fases 1 a 4 do plano original (setup, dados e cotações, dashboard, motor de aporte), mais o importador da planilha

## 1. Objetivo

O Koinos substitui a planilha `FII's.xlsx` (exportada do Google Sheets) por um app web pessoal que:

- consolida as posições a partir dos lançamentos de compra e venda;
- mostra cotações, rentabilidade, evolução do patrimônio e composição da carteira;
- recomenda o aporte do mês pela metodologia pública da Suno: ranking, preço teto e % de alocação sugerida.

### Critérios de sucesso

1. Depois da importação, a quantidade de cada ativo é igual à coluna `QTD.` da aba "Gráficos".
2. O dashboard abre com dados do cache em menos de 1 s e atualiza as cotações em segundo plano.
3. O motor de aporte reproduz exatamente os exemplos do Apêndice A.
4. A cota gratuita da brapi (15 mil requisições/mês) nunca é ultrapassada.

## 2. Escopo

**Dentro deste ciclo**

- Next.js 16 com TypeScript strict, Tailwind 4 e shadcn/ui.
- Login com Google (Better Auth), restrito a uma lista de e-mails.
- MongoDB Atlas com Mongoose 9.
- Cotações pela brapi, com Yahoo Finance como reserva; histórico mensal e proventos pelo Yahoo.
- Cache de cotações no Mongo, atualização sob demanda e cron diário.
- Importador da planilha (script de linha de comando).
- Dashboard: cards, evolução mensal, aportes por mês, composição, alertas e tabela de posições.
- Transações: listar, criar, editar e excluir.
- Carteira Alvo: ranking Suno, preço teto, % sugerida, categoria e "na estratégia".
- Recomendações: motor de aporte pelo método Suno.

**Fora deste ciclo**

- Calendário de dividendos.
- Eventos corporativos (desdobramento, grupamento, bonificação, subscrição, amortização).
- Proventos recebidos somados ao L/P.
- Várias carteiras na interface, e várias estratégias Suno (Dividendos, Valor...) com % do patrimônio para cada uma.
- Importação pela interface (ex.: extrato da B3).
- O IPA antigo da planilha (a "nota base" digitada).
- Testes automatizados (unitários e end-to-end).
- Deploy automatizado: o usuário conecta o repositório na Vercel.

## 3. Decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Framework | Next.js 16.4 (App Router, Turbopack, React 19.3) | Versão estável atual; o plano pede "o mais moderno" |
| Node | 26.12.0 no ambiente local; `engines: ">=24"` | É o mais novo; as Functions da Vercel ainda só rodam 24.x |
| Banco | MongoDB Atlas M0 + Mongoose 9 | Prisma 7 não suporta Mongo; Prisma 6 perde suporte em 19/11/2026; o Mongo do Prisma 8 ainda é RC |
| Login | Better Auth 1.7 + Google + `@better-auth/mongo-adapter` | Auth.js passou a fazer parte do Better Auth, e o v5 continua beta, só com correções de segurança |
| Sessões | Redis Cloud via `secondaryStorage` do Better Auth (`@better-auth/redis-storage` + ioredis), com chave em HMAC-SHA256 e valor em AES-256-GCM, autenticado junto com a chave (AAD); rate limit também no Redis | Pedido do usuário. O banco do Redis Cloud não tem TLS, então o token nunca trafega em texto |
| Paralelismo | Na Vercel, o Fluid compute escala requisições e instâncias; no código, tarefas de rede em paralelo com limite por `os.availableParallelism()` (brapi gratuita: 1 por vez) | Pedido do usuário: aproveitar todos os núcleos |
| Cotações | Listagem em lote da brapi (`quote/list`: uma requisição traz os 679 fundos listados); cotação individual da brapi e depois Yahoo como reservas; Yahoo para histórico e proventos | Plano gratuito da brapi: cotação individual com 1 ticker por requisição, 15 mil/mês, sem dividendos, 3 meses de histórico. A listagem responde em lote e sem token (testado em 17/10/2026) |
| Atualização | Sob demanda (preço vencido) + cron diário | No plano Hobby, o cron da Vercel roda 1x por dia |
| Motor de aporte | Método Suno: cascata pelo ranking até a % sugerida, só abaixo do teto | Pedido do usuário; substitui o IPA da planilha |
| Base do peso | Só os ativos "na estratégia" | A Suno orienta separar uma fatia do patrimônio para cada carteira |
| Ativo sem teto | Não recebe aporte | Regra da Suno: só comprar abaixo do preço teto |
| % sugerida vazia | O que falta para 100% é dividido igualmente | A Suno publica as %; isto é só o fallback |
| Preço médio | Método da Receita | É o padrão; o da planilha abate vendas pelo preço de venda |
| Importação | Ativo por ativo: importa os de histórico consistente e pula os demais, com relatório | Pedido do usuário; corrigir datas por conta própria distorceria quantidades e preço médio |
| Testes automatizados | Nenhum; verificação por typecheck, lint, build e conferências pontuais | Decisão do usuário (projeto pessoal) |
| Tabelas | Table do shadcn + ordenação própria | A TanStack Table 9 trocou a API inteira, e as tabelas são pequenas |
| Ferramentas | Node 26.12.0, TypeScript 6.0.3, ESLint 10, shadcn base-nova (Base UI) | O TS 7 quebra o typescript-eslint do Next; o Node 26.12 é o mais novo |
| Pacotes | npm | É o único gerenciador instalado |

## 4. Arquitetura

### 4.1 Stack

| Camada | Escolha |
|---|---|
| App | Next.js 16.4, React 19.3, TypeScript 6.0.3 strict |
| Renderização | Cache Components + Partial Prefetching (`cacheComponents: true`, `partialPrefetching: true`) e React Compiler (`reactCompiler: true`) |
| UI | Tailwind CSS 4.3, shadcn/ui base-nova (Base UI; charts sobre Recharts 3), next-themes, sonner |
| Estado no cliente | TanStack Query 5 (autocomplete, refresh de cotações) e nuqs 2 (estado na URL) |
| Mutações | Server Actions com next-safe-action 8 e Zod 4 |
| Dados | Mongoose 9 (driver MongoDB do próprio Mongoose) |
| Login | Better Auth 1.7 + `@better-auth/mongo-adapter` |
| Mercado | `fetch` para a brapi, yahoo-finance2 4 para o Yahoo |
| Configuração | `@t3-oss/env-nextjs` (variáveis de ambiente validadas com Zod) |
| Scripts | tsx; read-excel-file 9 para ler o .xlsx |
| Qualidade | ESLint 10 (`eslint-config-next` + `no-restricted-imports` para as fronteiras), Prettier 3 (+ `prettier-plugin-tailwindcss`), GitHub Actions |

### 4.2 Padrões

1. **Monólito modular por features.** Cada feature tem regras puras, código de servidor e componentes, e só exporta uma API pública: `index.ts` para o cliente e `server.ts` para o servidor.
2. **Núcleo puro, bordas com I/O.** Posições, preço médio, pesos e o motor Suno são funções puras, sem Next, banco ou variáveis de ambiente.
3. **Ports & Adapters nas integrações.** As cotações e o histórico ficam atrás de interfaces. A brapi e o Yahoo são adaptadores e podem ser trocados sem mexer no resto.
4. **Data Access Layer (DAL).** É a recomendação do Next para projetos novos. São módulos `server-only` que conferem a sessão e o dono do dado e devolvem DTOs mínimos. Só a DAL acessa models, adaptadores e `env`.
5. **Cache Components e PPR.** A estrutura da página (layout, menu, cabeçalhos, skeletons) é pré-renderizada. O que depende da sessão chega por streaming dentro de `<Suspense>`. Dados compartilhados que mudam pouco usam `'use cache'` com `cacheLife` e `cacheTag`. Os dados do usuário e as cotações não usam `'use cache'`.
6. **Server Actions finas.** Cada action valida a entrada com Zod, roda o middleware de login do next-safe-action e delega para a DAL. Edições inline usam `useOptimistic`.
7. **Estado na URL.** Filtros, ordenação e o valor do aporte ficam em search params (nuqs), então dá para compartilhar e voltar.

### 4.3 Pastas

```
src/
  app/
    (public)/login/page.tsx
    (app)/layout.tsx               sidebar + cabeçalho (estrutura estática)
    (app)/dashboard/page.tsx
    (app)/transacoes/page.tsx
    (app)/carteira-alvo/page.tsx
    (app)/recomendacoes/page.tsx
    api/auth/[...all]/route.ts     handler do Better Auth
    api/cron/daily/route.ts        cron diário
    layout.tsx  globals.css  error.tsx  not-found.tsx
  proxy.ts                         redirecionamento otimista por cookie
  features/
    auth/          domain/ (allowlist) · server/ (Better Auth, sessão, carteira do usuário, cliente de actions) · components/
    transactions/  domain/ (posições, preço médio, validação do histórico, aportes por mês) · server/ · actions.ts · schemas.ts · components/ · import/ (parser puro)
    market-data/   domain/ (horário do pregão, vencimento) · ports.ts · adapters/ (brapi, yahoo) · server/ (models, serviços, trava) · actions.ts · components/
    strategy/      domain/ (pesos efetivos, teto suspeito) · server/ · actions.ts · schemas.ts · components/
    smart-buy/     domain/ (cascata Suno, prioridade de aporte) · components/
    portfolio/     domain/ (resumo, evolução, alertas, composição) · server/ (visão consolidada) · components/ (dashboard)
    (cada feature expõe index.ts para o cliente e server.ts para o servidor; portfolio depende das outras, e nenhuma depende de portfolio)
  shared/
    ui/            componentes do shadcn
    components/    layout (sidebar, cabeçalho, alternar tema)
    lib/           utils, formatação pt-BR, tipos de resultado
    db/            client do MongoDB + conexão do Mongoose
    env.ts
scripts/
  import-planilha.ts
```

### 4.4 Regras de dependência (verificadas pelo `no-restricted-imports` do ESLint)

- `app/` importa de cada feature só `index.ts`, `server.ts` e `actions.ts`, além de `shared/`.
- Uma feature importa `shared/` e a API pública de outras features, nunca os arquivos internos delas.
- `domain/` não importa Next, React, Mongoose, adaptadores nem `env`.
- `server/` começa com `import 'server-only'`.
- Componentes cliente podem importar `actions.ts` da feature, mas nunca `server/`.

## 5. Modelo de dados

O Better Auth gerencia as coleções `user`, `session`, `account` e `verification`. O app guarda o id do usuário como string.

**`portfolios`**

| Campo | Tipo | Regra |
|---|---|---|
| `userId` | string | índice |
| `name` | string | padrão "Carteira Principal" |
| `isDefault` | boolean | índice único parcial em `{ userId, isDefault: true }` |
| `createdAt`, `updatedAt` | Date | automáticos |

A carteira padrão é criada no primeiro acesso (`findOneAndUpdate` com upsert).

**`transactions`**

| Campo | Tipo | Regra |
|---|---|---|
| `portfolioId` | ObjectId | obrigatório |
| `ticker` | string | maiúsculas, `^[A-Z0-9]{4}\d{1,2}$` (aceita `B3SA3`) |
| `type` | `'BUY' \| 'SELL'` | obrigatório |
| `quantity` | number | > 0; decimais permitidos (há frações históricas, como o IRIM11) |
| `unitPrice` | number | > 0 |
| `fees` | number | ≥ 0, padrão 0; entra no custo da compra e é abatido da venda |
| `date` | Date | meia-noite UTC do dia do negócio; não pode ser futura |
| `source` | `'MANUAL' \| 'PLANILHA'` | origem do lançamento |
| `notes` | string | opcional |

Índices: `{ portfolioId, ticker, date }` e `{ portfolioId, date: -1 }`.

**`target_assets`** (a Carteira Alvo)

| Campo | Tipo | Regra |
|---|---|---|
| `portfolioId`, `ticker` | | índice único `{ portfolioId, ticker }` |
| `inStrategy` | boolean | padrão `true`; o "99" da planilha vira `false` |
| `sunoRank` | number \| null | inteiro ≥ 1 |
| `ceilingPrice` | number \| null | > 0 |
| `suggestedPercent` | number \| null | 0 < x ≤ 100 |
| `category` | enum \| null | `FII_TIJOLO`, `FII_PAPEL`, `FII_HIBRIDO`, `FII_FOF`, `FIAGRO`, `ACAO`, `ETF`, `OUTRO` |

**`assets`** (cache compartilhado; `_id` é o próprio ticker)

`name`, `logoUrl`, `subType` (`fii`, `fi-agro`, `etf`, `stock`...), `price`, `changePercent` (fração: 4,04% vira 0,0404), `quoteSource` (`'brapi' | 'yahoo'`), `quoteTime` (horário de mercado, quando a fonte informa), `quoteFetchedAt`, `dy12m` (fração), `lastDividend` (`{ amount, exDate }`), `dividendsFetchedAt`.

**`price_history`**: `_id` = `TICKER:YYYY-MM`, com `ticker`, `month` (`YYYY-MM`) e `close`. Só guarda meses já encerrados.

**`ticker_catalog`**: um documento com a lista de tickers da B3 (ticker, nome, tipo, subtipo, logo) e `fetchedAt`, montado a partir da listagem da brapi. É atualizado pelo cron e alimenta o autocomplete e a sugestão de categoria.

**`api_usage`**: `_id` = `brapi:YYYY-MM`, com `count`.

**`locks`**: `_id` (nome da trava) e `expiresAt`, com índice TTL para limpeza.

Valores são `number` (double). O arredondamento acontece só na exibição, em centavos, e no saldo do motor de aporte (seção 9).

## 6. Dados de mercado

### 6.1 Interfaces

```ts
interface QuoteProvider {
  readonly name: 'brapi' | 'yahoo';
  getQuotes(tickers: string[]): Promise<ProviderResult<Quote>>;
}
interface HistoryProvider {
  getMonthlyCloses(ticker: string, fromMonth: string): Promise<MonthlyClose[]>;
  getDividends(ticker: string, from: Date): Promise<Dividend[]>;
}
type Quote = { ticker: string; price: number; changePercent?: number; name?: string; logoUrl?: string; quoteTime: Date };
type ProviderResult<T> = { ok: Map<string, T>; failed: Map<string, string> };
```

### 6.2 Adaptadores

- **brapi:** envia `Authorization: Bearer BRAPI_TOKEN` quando o token existe. Faz uma requisição por vez, com timeout de 10 s, e cada chamada HTTP soma 1 em `api_usage`.
  1. **Lote:** `GET https://brapi.dev/api/quote/list?type=fund&limit=1000` traz todos os fundos numa resposta (`stock`, `close`, `change` em %, `logo`, `type`, `subType`). Se faltar algum ticker pedido, busca `type=stock` página a página (`hasNextPage`).
  2. **Individual:** o que não apareceu no lote é buscado em `GET https://brapi.dev/api/v2/stocks/quote?symbols={ticker}`, um ticker por requisição (`results[].data` com `regularMarketPrice`, `regularMarketChangePercent`, `longName`, `logourl` e `regularMarketTime`). Só funciona com token, porque FIIs exigem autenticação.
- **Yahoo** (yahoo-finance2): usa o ticker com sufixo `.SA`.
  - `quote()` busca vários tickers de uma vez.
  - `chart()` com intervalo mensal traz os fechamentos.
  - Os eventos de dividendos dão o DY 12m e o último rendimento.

### 6.3 Quando uma cotação vence (função pura)

O pregão da B3 vai de segunda a sexta, das 10:00 às 18:00 em `America/Sao_Paulo` (horário calculado com `Intl`). Há uma folga de 30 min por causa do atraso do plano gratuito.

- Nunca buscada: vencida.
- Dia útil entre 10:00 e 18:30: vence quando passa de 30 min desde a última busca.
- Fora desse horário: vence se a última busca foi antes do último fechamento, isto é, do dia útil mais recente às 18:30.
- Feriados não são considerados (custa só algumas requisições a mais).

### 6.4 Serviço de cotações

`refreshQuotes(tickers)`:

1. Pega a trava `quotes` por 60 s. Se ela já estiver ocupada, retorna `skipped`.
2. Separa só as cotações vencidas.
3. Se o uso do mês estiver abaixo de 90% de `BRAPI_MONTHLY_QUOTA`, busca na brapi (lote e depois individual). O que faltar vai para o Yahoo. Com a cota no limite, tudo vai para o Yahoo.
4. Grava o que deu certo, com `quoteFetchedAt = agora`. O que falhou mantém o valor anterior.
5. Libera a trava e retorna `{ updated, failed }`.

### 6.5 Gatilhos

- **Páginas** (dashboard, carteira alvo, recomendações):
  - O servidor manda quantas cotações estão vencidas entre os tickers em carteira e na Carteira Alvo.
  - Se houver alguma, `QuoteRefresher` chama `refreshQuotesAction` uma vez (TanStack Query `useMutation`) e, ao terminar, atualiza a rota.
  - O cabeçalho mostra "Cotações de HH:mm" e "atualizando…".
- **Cron diário:** `vercel.json` com `{"path": "/api/cron/daily", "schedule": "0 22 * * 1-5"}` (19:00 em Brasília). A rota exige `Authorization: Bearer CRON_SECRET` e:
  1. atualiza as cotações de todos os tickers em carteira ou em alguma Carteira Alvo, de qualquer usuário;
  2. atualiza `dy12m` (soma dos rendimentos dos últimos 12 meses ÷ preço) e `lastDividend`;
  3. grava fechamentos de meses encerrados que estejam faltando;
  4. atualiza o `ticker_catalog` com a listagem da brapi (fundos e ações).
- **Gráfico de evolução:** ao renderizar (dentro de `<Suspense>`), busca no Yahoo os meses que faltam para cada ticker, com uma requisição por ticker, e grava o resultado.

Uso esperado da brapi: até 3 requisições por atualização (fundos, mais ações em 2 páginas) × 2 por hora × 8 h × 22 pregões ≈ 1.060 por mês no pior caso, ou cerca de 350 com uma carteira só de fundos. A cotação individual só entra para tickers que faltarem na listagem.

## 7. Regras de cálculo (`domain/`)

### 7.1 Posições e preço médio (método da Receita)

Os lançamentos de cada ticker são ordenados por data, com as compras antes das vendas no mesmo dia e, depois, por `createdAt`.

- **Compra:** `qtd += q` e `custo += q × preço + taxas`.
- **Venda:**
  1. `pm = custo / qtd`;
  2. `realizado += q × preço − taxas − q × pm`;
  3. `custo −= q × pm`;
  4. `qtd −= q`.
  Se `|qtd| < 1e-9`, quantidade e custo viram 0.
- **Resultado por ticker:** `{ ticker, quantity, totalCost, averagePrice, realizedPnL }`.

`validateHistory(transactions)` devolve as vendas que superam a posição na data: `{ transactionId, ticker, date, sellQty, heldQty }`. Criar, editar ou excluir um lançamento é rejeitado se o resultado tiver qualquer violação.

### 7.2 Resumo

- **Por posição aberta:**
  - `valor = qtd × preço`. Sem cotação, usa o preço médio e marca a posição como "sem cotação".
  - `L/P = valor − custo` e `L/P% = L/P ÷ custo`.
  - `% carteira = valor ÷ patrimônio`.
- **Carteira:**
  - patrimônio = Σ valor;
  - investido = Σ custo;
  - L/P total e L/P realizado = Σ `realizedPnL`;
  - variação do dia = Σ (valor × `changePercent`) ÷ patrimônio.
- **DY 12m médio** = Σ (valor × `dy12m`) ÷ Σ valor, contando só os ativos que têm `dy12m`.
- **Renda mensal estimada** = Σ qtd × `lastDividend.amount`, contando só rendimentos com data ex dos últimos 62 dias.

### 7.3 Evolução mensal

Vai do mês do primeiro lançamento até o mês atual. Para cada mês:

- **Patrimônio:** Σ quantidade no fim do mês × fechamento do mês. O mês atual usa o preço atual.
- **Fechamento ausente:** usa o último fechamento anterior. Se não houver nenhum, usa o preço médio e marca o ponto como "estimado".
- **Investido:** Σ custo no fim do mês.

A conta percorre os lançamentos uma única vez, em ordem.

### 7.4 Aportes por mês e alertas

- **Aportes por mês:** Σ (q × preço + taxas) das compras, agrupado por `YYYY-MM`. O gráfico mostra os últimos 24 meses.
- **Concentração:** alerta quando um ativo passa de 10% do patrimônio (constante `CONCENTRATION_ALERT = 0.10`).
- **Teto suspeito:** alerta quando o teto é menor que 50% ou maior que 200% do preço atual.
- **Configuração incompleta:** ativo na estratégia sem ranking ou sem teto; soma das % sugeridas inválida (seção 8); ranks repetidos.

## 8. Estratégia Suno (Carteira Alvo)

A **estratégia** é o conjunto de `target_assets` com `inStrategy = true`, estejam ou não em carteira. Os outros ativos em carteira são "fora da estratégia": tanto os que têm `inStrategy = false` quanto os que ainda não têm documento em `target_assets`. Eles aparecem no dashboard, mas não entram nas contas de peso nem de aporte.

**Pesos efetivos** (`effectiveWeights`):

1. Se nenhum ativo tem `suggestedPercent`, todos recebem `1 / n`.
2. Caso contrário:
   - os ativos com % recebem a própria %;
   - o que falta para 100% (`max(0, 100 − Σ %)`) é dividido igualmente entre os ativos sem %;
   - no fim, tudo é normalizado para somar 1.
3. A tela avisa quando a soma das % passa de 100, ou quando todos têm % e a soma é diferente de 100.

**Valor da estratégia:** V = Σ valor atual dos ativos da estratégia que estão em carteira.

**Prioridade de aporte** (a coluna que substitui o IPA). É calculada como o motor da seção 9 com aporte zero (T = V):

- Os elegíveis que estão abaixo da meta, ordenados por ranking, recebem 1º, 2º, 3º...
- Os outros mostram o motivo: "Na meta", "Acima do teto", "Sem teto", "Sem ranking", "Sem cotação" ou "Fora da estratégia".

## 9. Motor de aporte (método Suno)

> **Atualizado em 2026-10-24:** o quanto cada FII pede passou a ser o gap até a meta vezes o Índice de Convicção (margem até o teto e P/VP), a sobra só roda quando todos compraram as cotas desejadas, e não há mais limite por FII. Ver `2026-10-24-indice-de-conviccao-design.md`.

### 9.1 Regras de origem

As regras vêm das orientações da Suno no Suno Conecta:

1. Só comprar abaixo do preço teto.
2. Priorizar os primeiros do ranking, respeitando a % de alocação sugerida: levar o 1º até a % dele, depois passar ao 2º, ao 3º e assim por diante.
3. Se tudo estiver abaixo do teto e na meta, aportar no ativo com menor peso ou mais abaixo do seu preço médio.

Princípio do Tiago Reis: regularidade de aportes, diversificação e fundamentos, sem tentar acertar o momento. Na acumulação, a carteira se rebalanceia pelos aportes, sem vender.

### 9.2 Entrada

- `X`: valor do aporte, maior que 0 (validado com Zod).
- Ativos da estratégia, cada um com `ticker`, `rank`, `ceiling`, `w` (peso efetivo), `price`, `quantity` (≥ 0) e `averagePrice`.

### 9.3 Algoritmo (`sunoCascade`)

**Definições**

- `v_i = quantity_i × price_i`
- `V = Σ v_i`, `T = V + X` e `meta_i = w_i × T`
- O saldo é arredondado em centavos depois de cada compra.

**Elegibilidade.** A primeira regra que falhar define o motivo de exclusão:

1. `SEM_COTACAO`: sem preço.
2. `SEM_RANKING`: sem ranking.
3. `SEM_TETO`: sem teto.
4. `ACIMA_DO_TETO`: `price ≥ ceiling`. A regra é estrita: só compra com preço abaixo do teto.

**Passo 1, cascata.** Percorre os elegíveis por ranking (crescente; empate pelo ticker). Para cada ativo:

- `falta = meta_i − (v_i + n_i × p_i)`
- `quero = falta > 0 ? floor(falta / p_i + 0.5) : 0`: arredonda para a cota mais próxima, então só compra se faltar pelo menos meia cota.
- `posso = floor(saldo / p_i + 1e-9)`: a folga evita erro de ponto flutuante em múltiplos exatos
- `n = min(quero, posso)`; soma `n` em `n_i` e desconta `n × p_i` do saldo.

Quando o dinheiro não alcança um ativo, a cascata continua: um ativo mais barato mais abaixo no ranking ainda pode caber.

**Passo 2, sobra.** Só roda se, depois do passo 1, nenhum elegível tiver `quero > 0` (todos na meta). Enquanto algum elegível tiver `p_i ≤ saldo`, compra 1 cota do que tiver:

- menor `(v_i + n_i p_i) / meta_i`, só entre os de `meta_i > 0`;
- em caso de empate, maior desconto sobre o preço médio, `(pm_i − p_i) / pm_i` (0 se não estiver em carteira);
- persistindo o empate, melhor ranking.

**Status de cada elegível**

- `n_i > 0`: vira ordem. `fromLeftover` conta as cotas que vieram do passo 2.
- `n_i = 0` e `quero > 0`: `SEM_SALDO`.
- `n_i = 0` e `quero = 0`: `NA_META`.

### 9.4 Saída

```ts
type SunoCascadeResult = {
  orders: Array<{
    ticker: string; rank: number; quantity: number; fromLeftover: number;
    price: number; total: number;
    weightBefore: number;   // v_i / V (0 se V = 0)
    weightAfter: number;    // (v_i + n_i p_i) / (V + gasto)
    targetWeight: number;   // w_i
    marginToCeiling: number; // (teto − preço) / teto
    gapBefore: number;      // meta_i − v_i
  }>;
  excluded: Array<{ ticker: string; rank: number | null; reason: 'SEM_COTACAO' | 'SEM_RANKING' | 'SEM_TETO' | 'ACIMA_DO_TETO' | 'NA_META' | 'SEM_SALDO' }>;
  spent: number;
  leftover: number;
};
```

As ordens saem ordenadas por ranking. A tela monta a explicação de cada ordem a partir desses campos (ex.: "4º do ranking, 19% abaixo do teto, faltavam R$ 6.483 para a meta").

## 10. Telas

**Layout geral**

- Sidebar do shadcn (recolhível em ícones) com Dashboard, Transações, Carteira Alvo e Recomendações.
- Cabeçalho com status das cotações, alternância claro/escuro e menu do usuário.
- Formatos pt-BR (R$, dd/mm/aaaa).
- Responsivo até 360 px: as tabelas rolam na horizontal com a primeira coluna fixa.

**/login**

Botão "Entrar com Google". Quem já tem sessão vai direto para o dashboard. Um e-mail fora da lista volta para o login com a mensagem "E-mail não autorizado".

**/dashboard**

- **Cards:**
  1. Patrimônio (número em destaque), com a variação do dia, o investido e o número de ativos.
  2. L/P não realizado, em R$ e %, com o L/P realizado.
  3. DY 12m médio, com a renda mensal estimada.
- **Gráficos:** evolução (área: Patrimônio × Investido), aportes por mês (barras) e composição por categoria e por ativo (donuts com até 6 fatias: os 5 maiores + "Outros").
- **Alertas:** concentração, teto suspeito, configuração incompleta e cotações desatualizadas.
- **Tabela de posições:** Ativo (logo, ticker e nome) · Rank · Qtd. · Preço atual · Preço médio · Preço teto · Valor atual · Valor investido · L/P (R$, com o % embaixo) · % carteira · Prioridade. O peso na estratégia × meta fica na Carteira Alvo; assim a tabela cabe em 1440 px.
  - Ordenável, com a ordenação na URL. Como no Finder, só a coluna ordenada mostra a seta.
  - L/P em verde ou vermelho.
  - Ícone ✓ "abaixo do teto" quando preço < teto, com a margem no tooltip. Com teto suspeito, só o aviso.
- **Posições encerradas:** seção recolhível com o L/P realizado de cada uma.

**/transacoes**

- **Filtros** na URL: ativo, tipo e ano.
- **Tabela:** Data · Ativo · Tipo · Qtd. · Preço · Taxas · Total · Origem · Ações.
- **Formulário** em diálogo:
  - campos: ativo (combobox com o catálogo), tipo, data, quantidade, preço, taxas e observação;
  - uma venda que quebra o histórico é rejeitada com a mensagem "Venda de X cotas em dd/mm/aaaa, mas a posição nessa data é Y".
- **Exclusão:** pede confirmação.

**/carteira-alvo**

- **Linhas:** uma por ativo em carteira ou com configuração.
- **Colunas:** Ativo · Estratégia (switch) · Rank · Teto (R$) · % sugerida · Categoria · Preço atual · Margem (até o teto) · Peso / meta (peso na estratégia × meta efetiva) · Prioridade.
- **Edição:** inline, com atualização otimista.
- **Ações:** adicionar ativo (combobox) e remover configuração.
- **Categoria sugerida** pelo subtipo da brapi: `fi-agro` → Fiagro, `etf` → ETF, `stock` → Ação. Para FIIs, você escolhe entre tijolo, papel, híbrido e FoF.
- **Rodapé:** soma das % sugeridas, número de ativos na estratégia e alertas.

**/recomendacoes**

- **Entrada:** campo "Quanto vou aportar hoje?" (R$), guardado na URL como `?valor=`.
- **Contexto:** horário das cotações e uma faixa fixa com os princípios: "Aporte todo mês · Só abaixo do teto · Siga o ranking até a % sugerida · Rebalanceie com aportes, não com vendas".
- **Resultado:**
  - resumo com valor, gasto e sobra;
  - tabela de ordens: Ativo · Cotas · Preço · Total · % antes → depois · % meta · Por quê (com a posição no ranking);
  - excluídos agrupados por motivo, mais a lista "fora da estratégia";
  - botão "Copiar ordens".
- **Cálculo:** roda no navegador com a função pura, a partir de um DTO montado no servidor.

## 11. Login e segurança

- **Better Auth:**
  - adapter `mongodbAdapter(db, { client })`, com transações (o Atlas M0 é replica set);
  - provedor social `google`;
  - `session.cookieCache` de 5 min;
  - plugin `nextCookies()`.
- **Conexão:** o `MongoClient` é criado com o driver do Mongoose (`mongoose.mongo.MongoClient`) e reaproveitado pelo Mongoose via `connection.setClient`. Fica guardado em `globalThis` em desenvolvimento.
- **Allowlist:** `ALLOWED_EMAILS` é obrigatório. `databaseHooks.user.create.before` recusa e-mails fora da lista ou não verificados pelo Google (`emailVerified`), e a DAL confere a lista de novo a cada requisição.
- **`proxy.ts`:** usa `getSessionCookie` só para redirecionar rápido para `/login`. A checagem real fica na DAL.
- **DAL:**
  - `getCurrentUser` (`'use cache: private'`) chama `auth.api.getSession({ headers })`, redireciona sem sessão e confere a allowlist;
  - `getTenant` (React `cache`) chama `connection()` antes do banco e cria a carteira padrão quando preciso; `requireTenant` faz o mesmo, sem cache, para actions e route handlers;
  - nenhuma consulta recebe `portfolioId` do cliente.
- **Actions:**
  - o middleware do next-safe-action confere a sessão;
  - edição e exclusão confirmam que o documento pertence à carteira do usuário;
  - o retorno é só o que a interface precisa.
- **Cron:** compara `Authorization: Bearer CRON_SECRET` em tempo constante.

### 11.1 Isolamento de dados por usuário

Cada usuário logado só enxerga e altera os próprios dados. As defesas, camada por camada:

1. **Dono vem da sessão.** Toda leitura e escrita filtra pelo `portfolioId` que a DAL obtém da sessão. Um id vindo do cliente nunca define o dono do dado.
2. **Escrita atômica com dono.** Editar ou excluir usa o filtro `{ _id, portfolioId }` numa única operação no banco. Um id de outra carteira simplesmente não encontra nada.
3. **Repositórios fechados.** As funções de repositório recebem o `portfolioId` explicitamente e só são chamadas pela DAL ou pelo importador local. Páginas e componentes não as importam (regra de lint).
4. **DTOs mínimos.** Nada de `userId`, `portfolioId` ou documentos crus do Mongo chega ao navegador.
5. **Cache sem mistura.** `'use cache'` só guarda dado público de mercado (catálogo e histórico de preços). Dado de carteira nunca vai para cache compartilhado. A sessão usa `'use cache: private'`, que fica só no navegador do próprio usuário. Chaves e tags de cache não levam dados pessoais.
6. **Entradas.** Toda entrada passa por Zod, e o Mongoose roda com `sanitizeFilter` para bloquear injeção de operadores (`$ne`, `$gt`...).
7. **APIs.** A busca de tickers exige sessão e responde `Cache-Control: private, no-store`. O cron devolve só contagens, nunca dados de carteiras.
8. **Erros.** Uma action com falha devolve mensagem genérica; o detalhe fica só no log do servidor, sem tokens nem payloads.
9. **Navegador.** Cabeçalhos X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy e HSTS, mais `poweredByHeader: false`.
10. **Segredos e dependências.** Segredos só em variáveis de servidor, nenhuma `NEXT_PUBLIC_` com segredo. O npm 11.20 bloqueia scripts de instalação não aprovados, e o CI roda `npm audit`.

## 12. Importador da planilha

**Comando:** `npm run import:planilha -- --file "<caminho do .xlsx>" --email <e-mail> [--dry-run] [--replace]`

**Pré-requisitos:** `.env.local` com `MONGODB_URI` e pelo menos um login feito com esse e-mail. A carteira padrão é criada se ainda não existir.

**Leitura** (os nomes das abas são comparados sem acento e sem diferenciar maiúsculas):

- **"Movimentações":** cabeçalho na linha 1, com colunas `DATA, PAPEL, TIPO, QUANTIDADE, VALOR, TOTAL`.
- **"Encerradas":** sem cabeçalho, com as mesmas colunas de A a F. São lidas as linhas que têm data em A e tipo em C; as colunas G e H são ignoradas.
- **"Gráficos":** colunas `PAPEL`, `Rank` e `PRÇ. TETO` da tabela de posições.

**Conversão dos lançamentos:**

- tipo: espaços removidos e caixa baixa; `compra` → `BUY` e `venda` → `SELL`;
- quantidade: `|QUANTIDADE|` (a venda vem negativa);
- preço: `VALOR`; taxas: 0;
- data: dia em UTC;
- origem: `source = 'PLANILHA'`.

**Validação, ativo por ativo:**

- formato do ticker, data, quantidade diferente de zero e preço maior que zero;
- `validateHistory` no histórico do ativo;
- quantidade final igual à coluna `QTD.` da aba "Gráficos", quando o ativo aparece lá.

Um ativo só é importado se passar em tudo. Os outros são pulados, e o relatório mostra aba, linha, data, quantidade vendida e posição na data. A configuração da Carteira Alvo desses ativos também fica de fora, para o motor não tratar como zerada uma posição que existe. Com a planilha de 17/10/2026, entram 19 ativos e ficam de fora PMLL11, VISC11, XPML11, ALZR11 e IRIM11.

**Gravação:**

1. Se já existirem lançamentos `PLANILHA` e não houver `--replace`, aborta. Com `--replace`, apaga primeiro os lançamentos `PLANILHA` da carteira.
2. Insere os lançamentos.
3. Faz upsert dos `target_assets` dos ativos importados, a partir de "Gráficos":
   - `inStrategy = rank ≠ 99`;
   - `sunoRank = rank` (só quando ≠ 99);
   - `ceilingPrice = teto > 0 ? teto : null`;
   - categoria e % sugerida não são alteradas.

**Relatório:** contagem por aba, quantidade final por ticker comparada com `QTD.` da planilha (avisa se divergir), tetos suspeitos e ativos sem teto.

O arquivo do usuário nunca entra no repositório: `.gitignore` inclui `*.xlsx`.

## 13. Erros e estados degradados

- **Fonte de cotação fora do ar:** fica o último preço, com selo de desatualizado e o horário. Nas recomendações, uma cotação de outro pregão gera o aviso "cotação de dd/mm".
- **Histórico indisponível:** o gráfico usa o fallback da seção 7.3 e marca os pontos estimados.
- **Banco indisponível:** `error.tsx` mostra "Não foi possível carregar seus dados" com botão de tentar de novo.
- **Erros de action:** toast (sonner); erros de validação aparecem no próprio formulário.
- **Login recusado:** volta para `/login` com a mensagem.

## 14. Verificação e qualidade

Não há suíte de testes automatizados (decisão do usuário: projeto pessoal). Cada etapa é verificada com:

- `npm run lint` (incluindo as fronteiras da arquitetura) e `npm run typecheck`;
- `npm run build`;
- conferências pontuais, fora do repositório, das regras que mexem com dinheiro: preço médio e motor de aporte contra os exemplos do Apêndice A;
- teste manual das telas com `npm run dev`.

**CI (GitHub Actions):** em push e PR, roda lint, typecheck, build e `npm audit` em Node 24 e 26, com variáveis de ambiente fictícias.

## 15. Configuração e deploy

**Variáveis de ambiente**

| Variável | Obrigatória | Uso |
|---|---|---|
| `MONGODB_URI` | sim | conexão com o Atlas |
| `REDIS_URL` | sim | Redis das sessões e do rate limit (`rediss://` quando houver TLS) |
| `BETTER_AUTH_SECRET` | sim | segredo das sessões (32+ caracteres) |
| `BETTER_AUTH_URL` | sim | URL base (`http://localhost:3000` em dev) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | sim | OAuth do Google |
| `ALLOWED_EMAILS` | sim | e-mails permitidos, separados por vírgula |
| `BRAPI_TOKEN` | não | sem ele, só a listagem em lote funciona (a cotação individual de FIIs exige token) |
| `BRAPI_MONTHLY_QUOTA` | não | padrão 15000 |
| `CRON_SECRET` | sim em produção | protege o cron |

**Contas externas**

- **Google OAuth:** redirects autorizados `http://localhost:3000/api/auth/callback/google` e `https://<domínio>/api/auth/callback/google`.
- **Atlas:** cluster M0 e usuário com senha forte. O acesso de rede fica liberado para `0.0.0.0/0`, porque os IPs da Vercel mudam.
- **Vercel:** importar o repositório, definir as variáveis e deixar o cron em `vercel.json`.

**Node:** `.nvmrc` com `26.12.0` e `engines.node` = `">=24"`.

O README traz o passo a passo dessas três contas.

## 16. Próximos ciclos

- Calendário de dividendos (fonte oficial: FundosNET/B3).
- Eventos corporativos.
- Várias estratégias Suno com % do patrimônio para cada uma.
- Importação pela interface (B3).
- Proventos somados ao L/P.
- IPA antigo para comparação, se o usuário quiser.
- Testes end-to-end.

## Apêndice A: exemplos de referência do motor

### A.1 Carteira real (snapshot da planilha, aporte de R$ 14.000, peso igual de 1/17)

| Ticker | Rank | Qtd. | Preço | Teto | Valor |
|---|---|---|---|---|---|
| PMLL11 | 1 | 277 | 108,99 | 122 | 30.190,23 |
| BTLG11 | 2 | 347 | 102,50 | 112 | 35.567,50 |
| VISC11 | 3 | 262 | 113,60 | 92 | 29.763,20 |
| TRXF11 | 4 | 299 | 71,80 | 89 | 21.468,20 |
| GARE11 | 5 | 3273 | 8,62 | — | 28.213,26 |
| XPML11 | 6 | 274 | 105,99 | 92 | 29.041,26 |
| MCCI11 | 7 | 293 | 94,90 | 10,40 | 27.805,70 |
| HGRU11 | 9 | 213 | 123,38 | 118 | 26.279,94 |
| RECR11 | 10 | 340 | 75,76 | 96 | 25.758,40 |
| VGIP11 | 11 | 354 | 76,49 | 83 | 27.077,46 |
| BRCO11 | 12 | 265 | 111,50 | 95 | 29.547,50 |
| FATN11 | 13 | 348 | 86,90 | 92 | 30.241,20 |
| RBRY11 | 14 | 274 | 88,58 | — | 24.270,92 |
| KNUQ11 | 17 | 267 | 101,79 | 106 | 27.177,93 |
| VRTA11 | 18 | 281 | 75,40 | 128 | 21.187,40 |
| XPLG11 | 20 | 279 | 99,89 | 114 | 27.869,31 |
| PVBI11 | 21 | 268 | 73,54 | 123 | 19.708,72 |

Contas: V = 461.168,13, T = 475.168,13 e meta = 27.951,07 por ativo.

**Ordens esperadas**

| Ticker | Cotas | Total |
|---|---|---|
| TRXF11 | 90 | 6.462,00 |
| RECR11 | 29 | 2.197,04 |
| VGIP11 | 11 | 841,39 |
| KNUQ11 | 8 | 814,32 |
| VRTA11 | 48 | 3.619,20 |

Gasto: 13.933,95. Sobra: 66,05.

**Excluídos esperados**

- `NA_META`: PMLL11, BTLG11, FATN11
- `ACIMA_DO_TETO`: VISC11, XPML11, MCCI11, HGRU11, BRCO11
- `SEM_TETO`: GARE11, RBRY11
- `SEM_SALDO`: XPLG11, PVBI11

O passo 2 não roda, porque ainda há elegíveis abaixo da meta.

### A.2 Sobra (passo 2)

| Ticker | Rank | Qtd. | Preço | Teto | % sugerida |
|---|---|---|---|---|---|
| AAAA11 | 1 | 100 | 10,00 | 20 | 50 |
| BBBB11 | 2 | 10 | 100,00 | 200 | 50 |

Com aporte de R$ 50: T = 2.050 e meta = 1.025 por ativo.

1. No passo 1, AAAA11 quer `floor(25/10 + 0,5) = 3` cotas e compra 3 (saldo 20). BBBB11 quer `floor(25/100 + 0,5) = 0`.
2. Todos estão na meta, então roda o passo 2. Só AAAA11 cabe no saldo e recebe 2 cotas.
3. Resultado: AAAA11 com 5 cotas (`fromLeftover = 2`), total R$ 50,00, sobra 0. BBBB11 fica como `NA_META`.

## Apêndice B: problemas encontrados na planilha (versão de 17/10/2026)

1. **Totais sem o BTLG11.** "Resultados" soma as linhas 3 a 22. O investido correto é R$ 862.960,38 (a planilha mostra R$ 828.351,77) e o valor atual é R$ 792.831,13 (mostra R$ 757.263,63).
2. **Preço médio diferente.** A planilha abate as vendas pelo preço de venda. Os 7 FIIs com venda (BTLG11, VGIP11, PMLL11, XPML11, MCCI11, VISC11, TRXF11) terão preço médio diferente no app.
3. **Tetos.** Suspeitos: MCCI11 R$ 10,40 (cota a R$ 94,90) e SNAG11 R$ 135 (cota a R$ 9,85). Sem teto: SNCI11, RBRY11 e GARE11.
4. **Vendas maiores que a posição na data.** Provavelmente são datas digitadas erradas. Precisam ser corrigidas antes de importar:

   | Aba | Linha | Data | Ticker | Venda | Posição na data |
   |---|---|---|---|---|---|
   | Movimentações | 217 | 14/12/2021 | PMLL11 | 42 | 9 |
   | Movimentações | 247 | 08/06/2021 | XPML11 | 26 | 0 |
   | Movimentações | 252 | 11/05/2021 | VISC11 | 73 | 17 |
   | Encerradas | 10 | 03/07/2020 | ALZR11 | 25 | 24 |
   | Encerradas | 9 | 28/05/2021 | ALZR11 | 54 | 25 (já descontando o ajuste da linha 10) |
   | Encerradas | 44 | 11/02/2026 | IRIM11 | 251 | 249,92 (frações do fator 0,88) |

5. **"Compra " com espaço no fim** em 2 linhas. O importador corrige.
6. **Subtotal errado em "Encerradas".** O subtotal do TGAR11 (`G66 = SUM(D66:F66)`) soma colunas erradas. Isso não afeta a importação.
